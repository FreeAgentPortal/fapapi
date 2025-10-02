import KSUID from 'ksuid';
import PaymentProcessor from '../PaymentProcess';
import axios, { AxiosResponse } from 'axios';
import { CommonTransactionType } from '../../../../types/CommonTransactionType';
import CommonCaptureTypes from '../../../../types/CommonCaptureTypes';
import CommonVoidTypes from '../../../../types/CommonVoidTypes';
import CommonRefundTypes from '../../../../types/CommonRefundTypes';
import { PaynetworxAuthType, PaynetworxCaptureType, PaynetworxRefundType, PaynetworxVoidTypes, PaynetworxVaultType, PaynetworxTokenType } from './pnxtypes';

/**
 * @description PaynetworxProcessor - A modernized payment processor for PayNetWorx API
 * @class PaynetworxProcessor
 * @extends PaymentProcessor
 * @export
 * @version 2.0.0
 * @since 1.0.0
 */
class PaynetworxProcessor extends PaymentProcessor {
  private readonly baseURL: string;
  private readonly merchantUser: string;
  private readonly merchantPass: string;
  private readonly authToken: string;

  constructor() {
    super();

    // Initialize credentials from environment variables
    this.baseURL = process.env.PAYNETWORX_BASE_URL || '';
    this.merchantUser = process.env.PAYNETWORX_MERCHANT_USER || '';
    this.merchantPass = process.env.PAYNETWORX_MERCHANT_PASS || '';

    if (!this.baseURL || !this.merchantUser || !this.merchantPass) {
      throw new Error('PayNetWorx configuration is incomplete. Please check environment variables.');
    }

    this.authToken = `Basic ${Buffer.from(`${this.merchantUser}:${this.merchantPass}`).toString('base64')}`;
  }

  /**
   * @description Process a payment transaction
   * @param details - Transaction details
   * @param transactionType - Type of transaction ('auth' or 'authcapture')
   */
  processPayment(details: CommonTransactionType | any, transactionType: 'auth' | 'authcapture' = 'auth') {
    // if we have tokenId we need to run a different transaction type
    if (details?.tokenId as any) {
      transactionType = 'authcapture';
      return this.processPaymentWithToken(details.tokenId, details.amount, details.currency, details);
    }
    const paynetworxDetails = this.buildAuthPayload(details);
    return this.executeTransaction(paynetworxDetails, transactionType);
  }

  /**
   * @description Build PayNetWorx authorization payload from common transaction details
   * @private
   */
  private buildAuthPayload(details: CommonTransactionType): PaynetworxAuthType {
    return {
      Amount: {
        Total: details.amount.toFixed(2),
        Tax: details.tax?.toFixed(2),
        Shipping: details.shipping?.toFixed(2),
        Discount: details.discount?.toFixed(2),
        Currency: details.currency || 'USD',
      },
      PaymentMethod: {
        Card: {
          CardPresent: false,
          CVC: {
            CVC: details.cvv,
          },
          PAN: {
            PAN: details?.ccnumber ?? '',
            ExpMonth: details.ccexp?.month ?? '',
            ExpYear: details.ccexp?.year ?? '',
          },
          BillingAddress: {
            Name: `${details.first_name} ${details.last_name}`,
            Line1: details.address1,
            Line2: details.address2,
            City: details.city,
            State: details.state,
            PostalCode: details.zip,
            Country: details.country,
            Phone: details.phone,
            Email: details.email,
          },
        },
      },
      Detail: {
        MerchantData: {},
      },
    };
  }

  /**
   * @description Execute a PayNetWorx transaction
   * @private
   */
  private async executeTransaction(details: PaynetworxAuthType, transactionType: 'auth' | 'authcapture') {
    const endpoint = transactionType === 'auth' ? 'transaction/auth' : 'transaction/authcapture';

    try {
      const response = await this.makeApiRequest(endpoint, details);
      return {
        success: true,
        data: {
          ...response.data,
          transactionId: response.data.TransactionID,
        },
      };
    } catch (error: any) {
      return this.handleApiError(error);
    }
  }

  /**
   * @description Capture a previously authorized transaction
   */
  async captureTransaction(details: CommonCaptureTypes) {
    const paynetworxDetails = this.buildCapturePayload(details);

    try {
      const response = await this.makeApiRequest('transaction/capture', paynetworxDetails);
      return {
        success: true,
        data: {
          ...response.data,
          transactionid: response.data.TransactionID,
        },
      };
    } catch (error: any) {
      return this.handleApiError(error);
    }
  }

  /**
   * @description Build PayNetWorx capture payload
   * @private
   */
  private buildCapturePayload(details: CommonCaptureTypes): PaynetworxCaptureType {
    return {
      Amount: {
        Total: parseFloat(details.total.toFixed(2)),
        Tax: details?.tax ? parseFloat(details.tax.toFixed(2)) : 0,
        Fee: details?.fee ? parseFloat(details.fee.toFixed(2)) : 0,
        Currency: details.currency || 'USD',
      },
      TransactionID: details.transactionId,
      Detail: {
        MerchantData: {},
      },
    };
  }

  /**
   * @description Void a transaction
   */
  async voidTransaction(details: CommonVoidTypes) {
    const paynetworxDetails = this.buildVoidPayload(details);

    try {
      const response = await this.makeApiRequest('transaction/void', paynetworxDetails);
      return {
        success: true,
        data: {
          ...response.data,
          transactionid: response.data.TransactionID,
        },
      };
    } catch (error: any) {
      return this.handleApiError(error);
    }
  }

  /**
   * @description Build PayNetWorx void payload
   * @private
   */
  private buildVoidPayload(details: CommonVoidTypes): PaynetworxVoidTypes {
    return {
      TransactionID: details.transactionId,
      Reason: 'customer-cancellation',
      Detail: {
        MerchantData: {},
      },
    };
  }

  /**
   * @description Refund a transaction
   */
  async refundTransaction(details: CommonRefundTypes, currency: string = 'USD') {
    const paynetworxDetails = this.buildRefundPayload(details, currency);

    try {
      const response = await this.makeApiRequest('transaction/refund', paynetworxDetails);
      return {
        success: true,
        data: {
          ...response.data,
          transactionid: response.data.TransactionID,
        },
      };
    } catch (error: any) {
      return this.handleApiError(error);
    }
  }

  /**
   * @description Build PayNetWorx refund payload
   * @private
   */
  private buildRefundPayload(details: CommonRefundTypes, currency: string): PaynetworxRefundType {
    return {
      Amount: {
        Total: details.amount.toFixed(2),
        Currency: currency,
      },
      TransactionID: details.transactionId,
      Detail: {
        MerchantData: {},
      },
    };
  }

  /**
   * @description Make API request to PayNetWorx
   * @private
   */
  private async makeApiRequest(endpoint: string, payload: any): Promise<AxiosResponse> {
    const requestId = await KSUID.randomSync().string;

    return axios.post(`${this.baseURL}/${endpoint}`, payload, {
      headers: {
        'Request-ID': requestId,
        'Content-Type': 'application/json',
        Authorization: this.authToken,
      },
    });
  }

  /**
   * @description Handle API errors consistently
   * @private
   */
  private handleApiError(error: any) {
    // console.error('PayNetWorx API Error:', error);

    return {
      error: error?.response?.data,
      success: false,
      message: error?.message || 'PayNetWorx API request failed',
      data: {
        ...error?.response?.data,
        response_code: error?.response?.status || 500,
        responsetext: error?.response?.data?.Error || error?.message,
        transactionid: error?.response?.data?.TransactionID,
      },
    };
  }

  /**
   * @description Get processor name
   */
  getProcessorName(): string {
    return 'paynetworx';
  }

  /**
   * @description Create a vault token for future transactions
   */
  async createVault(customerId: string, vaultData: any) {
    const paynetworxDetails = this.buildVaultPayload(vaultData, customerId);

    try {
      const response = await this.makeApiRequest('transaction/verify', paynetworxDetails);

      if (response.data.Approved) {
        return {
          success: true,
          data: {
            tokenId: response.data.Token.TokenID,
            tokenName: response.data.Token.TokenName,
            transactionId: response.data.TransactionID,
            eventId: response.data.EventID,
            requestId: response.data.RequestID,
            addressCheck: response.data.AddressLine1Check,
            zipCheck: response.data.AddressZipCheck,
            cvcCheck: response.data.CVCCheck,
          },
          message: 'Vault created successfully',
        };
      } else {
        return {
          success: false,
          message: 'Vault creation failed - transaction not approved',
          data: response.data,
        };
      }
    } catch (error: any) {
      return this.handleApiError(error);
    }
  }

  /**
   * @description Build PayNetWorx vault payload for token creation
   * @private
   */
  private buildVaultPayload(vaultData: any, customerId: string): PaynetworxVaultType {
    // split ccexp
    const [month, year] = vaultData.creditCardDetails?.ccexp?.split('/') || [];
    return {
      PaymentMethod: {
        Card: {
          CardPresent: false,
          CVC: {
            CVC: vaultData.cvv || vaultData.creditCardDetails?.cvv || '000',
          },
          PAN: {
            PAN: vaultData.creditCardDetails?.ccnumber || '',
            ExpMonth: month || '',
            ExpYear: year || '',
          },
          BillingAddress: {
            Name: `${vaultData.first_name || ''} ${vaultData.last_name || ''}`.trim(),
            Line1: vaultData.address1 || '',
            Line2: vaultData.address2 || '',
            City: vaultData.city || '',
            State: vaultData.state || '',
            PostalCode: vaultData.zip || '',
            Country: vaultData.country || 'US',
            Phone: vaultData.phone || '',
            Email: vaultData.email || '',
          },
        },
      },
      DataAction: 'token/add',
      Attributes: {
        EntryMode: 'manual',
        ProcessingSpecifiers: {
          InitiatedByECommerce: true,
        },
      },
      TransactionEntry: {
        Device: 'NA',
        DeviceVersion: 'NA',
        Application: 'Merchant Website Express',
        ApplicationVersion: '1.0',
        Timestamp: new Date().toISOString(),
      },
      Detail: {
        MerchantData: {
          CustomerID: customerId,
          OrderNumber: `vault-${Date.now()}`,
          TrackingID: `track-${Date.now()}`,
        },
      },
    };
  }

  /**
   * @description Process payment using stored vault token
   */
  async processPaymentWithToken(tokenId: string, amount: number, currency: string = 'USD', orderDetails?: any) {
    const paynetworxDetails = this.buildTokenPayload(tokenId, amount, currency, orderDetails);

    try {
      const response = await this.makeApiRequest('transaction/authcapture', paynetworxDetails);
      return {
        success: true,
        data: {
          ...response.data,
          transactionid: response.data.TransactionID,
        },
      };
    } catch (error: any) {
      return this.handleApiError(error);
    }
  }

  /**
   * @description Build PayNetWorx token transaction payload
   * @private
   */
  private buildTokenPayload(tokenId: string, amount: number, currency: string, orderDetails?: any): PaynetworxTokenType {
    return {
      Amount: {
        Total: amount.toFixed(2),
        Currency: currency,
      },
      PaymentMethod: {
        Token: {
          TokenID: tokenId,
        },
      },
      Detail: {
        MerchantData: {
          CustomerID: orderDetails?.customerId || '',
          ...orderDetails?.additionalData,
        },
      },
      Attributes: {
        EntryMode: 'card-on-file',
        ProcessingSpecifiers: {
          InitiatedByECommerce: true,
        },
      },
    };
  }
}

export default PaynetworxProcessor;
