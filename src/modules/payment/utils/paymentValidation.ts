import { ErrorUtil } from '../../../middleware/ErrorUtil';

export interface PaymentFormValues {
  paymentMethod?: 'creditcard' | 'ach';
  stripeToken?: string;
  ccnumber?: string;
  ccexp?: string;
  cvv?: string;
  achDetails?: {
    checkname?: string;
    checkaba?: string;
    checkaccount?: string;
    account_holder_type?: string;
    account_type?: string;
  };
  [key: string]: any; // Allow for additional fields
}

/**
 * Validates payment form data based on the selected processor
 * @param processorName - The name of the payment processor (stripe, pyre, paynetworx)
 * @param paymentFormValues - The payment form data from frontend
 * @param paymentMethod - The payment method being used (creditcard, ach)
 * @returns boolean - true if validation passes
 * @throws ErrorUtil - if validation fails
 */
export function validatePaymentFormData(processorName: string, paymentFormValues: PaymentFormValues, paymentMethod: string): boolean {
  switch (processorName.toLowerCase()) {
    case 'stripe':
      return validateStripePaymentData(paymentFormValues, paymentMethod);

    case 'pyre':
    case 'paynetworx':
      // For now, these processors don't need special validation
      return true;

    default:
      throw new ErrorUtil(`Unsupported payment processor: ${processorName}`, 400);
  }
}

/**
 * Validates Stripe-specific payment data requirements
 */
function validateStripePaymentData(paymentFormValues: PaymentFormValues, paymentMethod: string): boolean {
  if (!paymentFormValues) {
    throw new ErrorUtil('Payment form values are required', 400);
  }

  if (paymentMethod === 'creditcard') {
    // For Stripe credit card payments, we require a stripeToken for PCI compliance
    if (!paymentFormValues.stripeToken) {
      throw new ErrorUtil('Stripe token is required for credit card payments', 400);
    }

    // Ensure no raw card data is being sent when using tokens
    if (paymentFormValues.ccnumber || paymentFormValues.cvv) {
      throw new ErrorUtil('Raw card data should not be sent when using Stripe tokens', 400);
    }
  } else if (paymentMethod === 'ach') {
    // For ACH payments, validate required ACH details
    if (!paymentFormValues.achDetails) {
      throw new ErrorUtil('ACH details are required for bank account payments', 400);
    }

    const { checkname, checkaba, checkaccount, account_holder_type, account_type } = paymentFormValues.achDetails;

    if (!checkname) {
      throw new ErrorUtil('Account holder name is required for ACH payments', 400);
    }

    if (!checkaba) {
      throw new ErrorUtil('Routing number is required for ACH payments', 400);
    }

    if (!checkaccount) {
      throw new ErrorUtil('Account number is required for ACH payments', 400);
    }

    if (!account_holder_type || !['individual', 'company'].includes(account_holder_type)) {
      throw new ErrorUtil('Valid account holder type (individual/company) is required for ACH payments', 400);
    }

    if (!account_type || !['checking', 'savings'].includes(account_type)) {
      throw new ErrorUtil('Valid account type (checking/savings) is required for ACH payments', 400);
    }
  } else {
    throw new ErrorUtil('Invalid payment method. Must be creditcard or ach', 400);
  }

  return true;
}

/**
 * Validates common required fields for all processors
 */
export function validateCommonPaymentFields(paymentFormValues: PaymentFormValues): boolean {
  if (!paymentFormValues) {
    throw new ErrorUtil('Payment form values are required', 400);
  }

  // Add any common validation logic here that applies to all processors
  // For example: name, address validation, etc.

  return true;
}
