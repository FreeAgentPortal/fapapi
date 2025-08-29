/**
 * Smart Payment Processing Utility
 * Drop-in replacement for existing payment processor selection
 */

import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';

export interface SmartPaymentOptions {
  preferredProcessors?: string[];
  testConnections?: boolean;
  fallbackProcessor?: string;
  environment?: 'development' | 'test' | 'production';
}

export class SmartPaymentProcessor {
  private static factory = new PaymentProcessorFactory();

  /**
   * Get a payment processor with smart selection
   * This can be used as a drop-in replacement for:
   * new PaymentProcessorFactory().chooseProcessor('pyre')
   */
  static async getProcessor(options: SmartPaymentOptions = {}) {
    const defaultOptions: SmartPaymentOptions = {
      preferredProcessors: [], // Use priority order
      testConnections: process.env.NODE_ENV === 'production',
      fallbackProcessor: 'pyre',
      environment: process.env.NODE_ENV as any || 'development'
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Environment-specific preferences
    if (finalOptions.preferredProcessors!.length === 0) {
      switch (finalOptions.environment) {
        case 'development':
        case 'test':
          finalOptions.preferredProcessors = ['stripe']; // Better test cards
          break;
        case 'production':
          finalOptions.preferredProcessors = ['pyre', 'stripe']; // Cost optimization
          break;
        default:
          finalOptions.preferredProcessors = ['stripe', 'pyre'];
      }
    }

    return await this.factory.smartChooseProcessor({
      preferredProcessors: finalOptions.preferredProcessors,
      testConnections: finalOptions.testConnections,
      fallbackProcessor: finalOptions.fallbackProcessor
    });
  }

  /**
   * Quick health check for monitoring
   */
  static async isPaymentSystemHealthy(): Promise<boolean> {
    try {
      const processors = await this.factory.getAvailableProcessors(true);
      return processors.some(p => p.available);
    } catch {
      return false;
    }
  }

  /**
   * Get detailed payment system status
   */
  static async getPaymentSystemStatus() {
    try {
      const processors = await this.factory.getAvailableProcessors(true);
      return {
        healthy: processors.some(p => p.available),
        processors: processors,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        healthy: false,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Example: Update your BillingHandler to use smart selection
 */
export class UpdatedBillingHandler {
  
  /**
   * Example of how to update your updateVault method
   */
  async updateVaultExample(req: any): Promise<Boolean> {
    const { id } = req.params;
    const { paymentFormValues, selectedPlans, billingCycle, paymentMethod } = req.body;

    // Your existing billing lookup logic
    // const billing = await BillingAccount.findOne({ profileId: id }).populate('payor');
    // if (!billing) throw new ErrorUtil('Could not find billing information', 404);

    // OLD WAY:
    // const processor = new PaymentProcessorFactory().chooseProcessor('pyre');

    // NEW WAY - Smart Selection:
    const { processor, processorName, reason } = await SmartPaymentProcessor.getProcessor({
      preferredProcessors: ['stripe', 'pyre'], // Prefer Stripe, fallback to Pyre
      testConnections: true
    });

    console.log(`[Billing] Using ${processorName}: ${reason}`);

    // Example vault creation (adjust based on your billing object structure)
    const vaultResponse = await processor.createVault('customer_id_here', {
      first_name: paymentFormValues.firstName,
      last_name: paymentFormValues.lastName,
      email: paymentFormValues.email,
      paymentMethod: paymentMethod,
      address1: paymentFormValues.address1,
      address2: paymentFormValues.address2,
      city: paymentFormValues.city,
      state: paymentFormValues.state,
      zip: paymentFormValues.zip,
      country: paymentFormValues.country,
      phone: req.user.phoneNumber,
      creditCardDetails: { ccnumber: paymentFormValues.ccnumber, ccexp: paymentFormValues.ccexp },
      achDetails: paymentFormValues.achDetails,
    });

    if (!vaultResponse.success) {
      throw new Error(`Payment processing failed: ${vaultResponse.message}`);
    }

    // Store the processor name and customer ID for future use
    // billing.processor = processorName;
    // billing.customerId = vaultResponse.customerId || billing.customerId;
    // await billing.save();

    console.log(`Vault created successfully with ${processorName}:`, vaultResponse.customerId);
    return true;
  }

  /**
   * Example of processing recurring payments with smart selection
   */
  async processRecurringPayment(customerId: string, amount: number, processorType?: string) {
    let processor, processorName;

    if (processorType) {
      // Use specific processor if requested
      const factory = new PaymentProcessorFactory();
      processor = factory.chooseProcessor(processorType);
      processorName = processorType;
    } else {
      // Smart selection
      const result = await SmartPaymentProcessor.getProcessor();
      processor = result.processor;
      processorName = result.processorName;
    }

    console.log(`[Recurring Payment] Using ${processorName} for customer ${customerId}`);

    return await processor.vaultTransaction({
      customer_vault_id: customerId,
      security_key: '', // Not needed for Stripe
      amount: amount,
      currency: 'usd',
      initiated_by: 'system',
      stored_credential_indicator: 'recurring'
    });
  }
}

/**
 * Health check route example
 */
export async function paymentHealthCheck(req: any, res: any) {
  try {
    const status = await SmartPaymentProcessor.getPaymentSystemStatus();
    
    res.status(status.healthy ? 200 : 503).json({
      service: 'payment-system',
      status: status.healthy ? 'healthy' : 'unhealthy',
      details: status
    });
  } catch (error: any) {
    res.status(500).json({
      service: 'payment-system',
      status: 'error',
      error: error?.message || 'Unknown error'
    });
  }
}
