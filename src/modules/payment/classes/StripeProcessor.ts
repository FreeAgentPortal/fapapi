import Stripe from 'stripe';
import PaymentProcessor from './PaymentProcess';
import { CommonTransactionType } from '../../../types/CommonTransactionType';
import { UserType } from '../models/User';
import CommonCaptureTypes from '../../../types/CommonCaptureTypes';
import CommonVoidTypes from '../../../types/CommonVoidTypes';
import CommonRefundTypes from '../../../types/CommonRefundTypes';

/**
 * @description StripeProcessing class, this class extends the PaymentProcessor class
 *              and implements the processPayment method to process payments with the Stripe
 *              payment gateway.
 * @class StripeProcessing
 * @extends PaymentProcessor
 * @export
 * @version 1.0.0
 * @since 1.0.0
 */
class StripeProcessing extends PaymentProcessor {
  private stripe: Stripe;

  constructor() {
    super();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
    });
  }

  processPayment(details: CommonTransactionType, user?: UserType) {
    // Implementation for direct payment processing
    // This could be used for one-time payments
  }

  async captureTransaction(details: CommonCaptureTypes, user: UserType) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.capture(details.transactionId);
      return {
        success: true,
        message: 'Transaction captured successfully',
        data: paymentIntent,
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Capture error:', error);
      return {
        success: false,
        message: `Error capturing transaction: ${error.message}`,
      };
    }
  }

  async voidTransaction(details: CommonVoidTypes, order: any) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(details.transactionId);
      return {
        success: true,
        message: 'Transaction voided successfully',
        data: paymentIntent,
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Void error:', error);
      return {
        success: false,
        message: `Error voiding transaction: ${error.message}`,
      };
    }
  }

  async refundTransaction(details: CommonRefundTypes, order: any) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: details.transactionId,
        amount: details.amount ? Math.round(details.amount * 100) : undefined, // Convert to cents
        reason: 'requested_by_customer',
      });
      return {
        success: true,
        message: 'Refund processed successfully',
        data: refund,
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Refund error:', error);
      return {
        success: false,
        message: `Error processing refund: ${error.message}`,
      };
    }
  }

  /**
   * Create a Stripe customer and store payment method (equivalent to vault)
   * This is Stripe's equivalent to PyreProcessing's createVault method
   */
  async createVault(
    customerId: string,
    details: {
      first_name: string;
      last_name?: string;
      address1?: string;
      address2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      phone?: string;
      email?: string;
      currency?: string;
      creditCardDetails?: {
        ccnumber?: string;
        ccexp?: string;
      };
      achDetails?: {
        checkname: string;
        checkaba: string;
        checkaccount: string;
        account_holder_type: string;
        account_type: string;
      };
      paymentMethod?: 'creditcard' | 'ach';
      customer_vault?: string;
    }
  ) {
    try {
      // Check if customer already exists in Stripe
      let stripeCustomer;
      try {
        stripeCustomer = await this.stripe.customers.retrieve(customerId);
        if (stripeCustomer.deleted) {
          throw new Error('Customer was deleted');
        }
      } catch (retrieveError) {
        // Customer doesn't exist, create new one
        stripeCustomer = await this.stripe.customers.create({
          name: `${details.first_name} ${details.last_name || ''}`.trim(),
          email: details.email,
          phone: details.phone,
          address: {
            line1: details.address1,
            line2: details.address2,
            city: details.city,
            state: details.state,
            postal_code: details.zip,
            country: details.country,
          },
          metadata: {
            external_id: customerId, // Store our custom ID in metadata
          },
        });
      }

      let paymentMethod;

      if (details.paymentMethod === 'creditcard' && details.creditCardDetails) {
        // Parse expiration date (assuming format like "1225" or "12/25")
        const expString = details.creditCardDetails.ccexp || '';
        let expMonth, expYear;

        if (expString.includes('/')) {
          [expMonth, expYear] = expString.split('/');
        } else if (expString.length === 4) {
          expMonth = expString.substring(0, 2);
          expYear = expString.substring(2, 4);
        }

        // Create payment method
        paymentMethod = await this.stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: details.creditCardDetails.ccnumber,
            exp_month: parseInt(expMonth || ''),
            exp_year: parseInt(`20${expYear}` || ''),
          },
          billing_details: {
            name: `${details.first_name} ${details.last_name || ''}`.trim(),
            email: details.email,
            phone: details.phone,
            address: {
              line1: details.address1,
              line2: details.address2,
              city: details.city,
              state: details.state,
              postal_code: details.zip,
              country: details.country,
            },
          },
        });

        // Attach payment method to customer
        await this.stripe.paymentMethods.attach(paymentMethod.id, {
          customer: stripeCustomer.id,
        });

        // Set as default payment method
        await this.stripe.customers.update(stripeCustomer.id, {
          invoice_settings: {
            default_payment_method: paymentMethod.id,
          },
        });
      } else if (details.paymentMethod === 'ach' && details.achDetails) {
        // Create ACH/Bank account payment method
        paymentMethod = await this.stripe.paymentMethods.create({
          type: 'us_bank_account',
          us_bank_account: {
            routing_number: details.achDetails.checkaba,
            account_number: details.achDetails.checkaccount,
            account_holder_type: details.achDetails.account_holder_type as 'individual' | 'company',
            account_type: details.achDetails.account_type as 'checking' | 'savings',
          },
          billing_details: {
            name: details.achDetails.checkname,
            email: details.email,
          },
        });

        // Attach payment method to customer
        await this.stripe.paymentMethods.attach(paymentMethod.id, {
          customer: stripeCustomer.id,
        });
      }

      return {
        success: true,
        message: 'Customer Vault Created',
        customerId: stripeCustomer.id,
        paymentMethodId: paymentMethod?.id,
        data: {
          customer: stripeCustomer,
          paymentMethod: paymentMethod,
        },
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Create vault error:', error);
      return {
        success: false,
        message: `Error Creating Vault Customer - ${error.message}`,
      };
    }
  }

  /**
   * Delete a customer's stored payment methods (equivalent to vault deletion)
   */
  async deleteVault(vaultId: string) {
    try {
      // Get all payment methods for the customer
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: vaultId,
      });

      // Detach all payment methods
      for (const pm of paymentMethods.data) {
        await this.stripe.paymentMethods.detach(pm.id);
      }

      // Optionally delete the customer entirely
      await this.stripe.customers.del(vaultId);

      return {
        success: true,
        message: 'Customer Vault Removed',
        data: { deletedCustomer: vaultId },
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Delete vault error:', error);
      return {
        success: false,
        message: `Error Removing Customer Vault - ${error.message}`,
      };
    }
  }

  /**
   * Process a payment using stored payment method (equivalent to vaultTransaction)
   * This is the key method for recurring billing with stored cards
   */
  async vaultTransaction(details: {
    customer_vault_id: string;
    security_key?: string; // Not needed for Stripe, but keeping interface consistent
    amount: number;
    currency?: string;
    initiated_by?: string;
    stored_credential_indicator?: string;
    payment_method_id?: string; // Optional specific payment method ID
  }) {
    try {
      const amountInCents = Math.round(details.amount * 100); // Convert to cents

      // Get customer's default payment method if not specified
      let paymentMethodId = details.payment_method_id;
      if (!paymentMethodId) {
        const customer = await this.stripe.customers.retrieve(details.customer_vault_id);
        if ('invoice_settings' in customer && customer.invoice_settings?.default_payment_method) {
          paymentMethodId = customer.invoice_settings.default_payment_method as string;
        } else {
          // Get the first available payment method
          const paymentMethods = await this.stripe.paymentMethods.list({
            customer: details.customer_vault_id,
            limit: 1,
          });
          if (paymentMethods.data.length === 0) {
            throw new Error('No payment methods found for customer');
          }
          paymentMethodId = paymentMethods.data[0].id;
        }
      }

      // Create and confirm payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: details.currency || 'usd',
        customer: details.customer_vault_id,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true, // Indicates this is for a recurring payment
        metadata: {
          initiated_by: details.initiated_by || 'system',
          stored_credential_indicator: details.stored_credential_indicator || 'recurring',
        },
      });

      return {
        success: true,
        message: 'Vault transaction processed successfully',
        transactionId: paymentIntent.id,
        status: paymentIntent.status,
        data: paymentIntent,
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Vault transaction error:', error);
      return {
        success: false,
        message: `Error processing vault transaction: ${error.message}`,
        errorCode: error.code,
      };
    }
  }

  /**
   * Get customer and payment method information
   */
  async getVault(vaultId: string) {
    try {
      const customer = await this.stripe.customers.retrieve(vaultId);
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: vaultId,
      });

      return {
        success: true,
        data: {
          customer,
          paymentMethods: paymentMethods.data,
        },
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Get vault error:', error);
      return {
        success: false,
        message: `Error Fetching Customer - ${error.message}`,
      };
    }
  }

  /**
   * Fetch transaction history for a customer
   */
  async fetchTransactions(customerId: string) {
    try {
      // Get payment intents for the customer
      const paymentIntents = await this.stripe.paymentIntents.list({
        customer: customerId,
        limit: 100,
      });

      // Get charges for more detailed transaction info
      const charges = await this.stripe.charges.list({
        customer: customerId,
        limit: 100,
      });

      return {
        success: true,
        data: {
          paymentIntents: paymentIntents.data,
          charges: charges.data,
        },
        payload: {
          data: charges.data, // For compatibility with existing code expecting payload.data
        },
      };
    } catch (error: any) {
      console.error('[StripeProcessor] Fetch transactions error:', error);
      return {
        success: false,
        message: `Error Fetching Transactions - ${error.message}`,
      };
    }
  }

  /**
   * Get the processor name for identification
   */
  getProcessorName() {
    return 'stripe';
  }
}

export default StripeProcessing;
