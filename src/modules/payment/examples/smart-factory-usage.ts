/**
 * Smart PaymentProcessorFactory Usage Examples
 * This demonstrates the new smart processor selection capabilities
 */

import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';

export class PaymentService {
  private factory = new PaymentProcessorFactory();

  /**
   * Example 1: Smart processor selection with defaults
   * This will automatically choose the best available processor
   */
  async processPaymentSmart(amount: number, customerId: string) {
    try {
      // Let the factory choose the best processor automatically
      const { processor, processorName, reason } = await this.factory.smartChooseProcessor();

      console.log(`Using ${processorName}: ${reason}`);

      // Process payment using the selected processor
      const result = (await processor.vaultTransaction({
        customer_vault_id: customerId,
        security_key: '', // Not needed for Stripe, but required by interface
        amount: amount,
        currency: 'usd',
        initiated_by: 'system',
        stored_credential_indicator: 'recurring',
      })) as any;

      return {
        success: result?.success ?? false,
        processor: processorName,
        data: result,
      };
    } catch (error) {
      console.error('Smart payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Example 2: Smart processor selection with preferences
   * Prefer Stripe, fallback to Pyre if Stripe is unavailable
   */
  async processPaymentWithPreferences(amount: number, customerId: string) {
    try {
      const { processor, processorName, reason } = await this.factory.smartChooseProcessor({
        preferredProcessors: ['stripe', 'pyre'], // Try Stripe first, then Pyre
        testConnections: true, // Test actual connections
        fallbackProcessor: 'pyre', // Use Pyre if all preferred fail
      });

      console.log(`Selected ${processorName}: ${reason}`);

      return await processor.vaultTransaction({
        customer_vault_id: customerId,
        security_key: '', // Not needed for Stripe, but required by interface
        amount: amount,
        currency: 'usd',
        initiated_by: 'system',
        stored_credential_indicator: 'recurring',
      });
    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Example 3: Check processor availability before processing
   */
  async checkAndProcessPayment(amount: number, customerId: string) {
    try {
      // First, check what processors are available
      const availableProcessors = await this.factory.getAvailableProcessors(true);

      console.log('Available processors:');
      availableProcessors.forEach((p) => {
        console.log(`- ${p.name}: ${p.available ? '✅' : '❌'} (${p.reason})`);
      });

      // Find the first available processor
      const firstAvailable = availableProcessors.find((p) => p.available);

      if (!firstAvailable) {
        throw new Error('No payment processors are available');
      }

      const processor = this.factory.chooseProcessor(firstAvailable.name);

      return await processor.vaultTransaction({
        customer_vault_id: customerId,
        security_key: '', // Not needed for Stripe, but required by interface
        amount: amount,
        currency: 'usd',
        initiated_by: 'system',
        stored_credential_indicator: 'recurring',
      });
    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Example 4: Environment-based processor selection
   * Use different logic for development vs production
   */
  async processPaymentByEnvironment(amount: number, customerId: string) {
    const isDev = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';

    let preferences: string[];

    if (isDev || isTest) {
      // In development, prefer processors that are easier to test
      preferences = ['stripe']; // Stripe has better test cards
    } else {
      // In production, prefer based on cost or reliability
      preferences = ['pyre', 'stripe']; // Pyre might have better rates
    }

    const { processor, processorName, reason } = await this.factory.smartChooseProcessor({
      preferredProcessors: preferences,
      testConnections: !isTest, // Skip connection tests in test environment
      fallbackProcessor: 'stripe',
    });

    console.log(`Environment: ${process.env.NODE_ENV}, Using: ${processorName} (${reason})`);

    return await processor.vaultTransaction({
      customer_vault_id: customerId,
      security_key: '', // Not needed for Stripe, but required by interface
      amount: amount,
      currency: 'usd',
      initiated_by: 'system',
      stored_credential_indicator: 'recurring',
    });
  }

  /**
   * Example 5: Health check endpoint for monitoring
   */
  async getPaymentSystemHealth() {
    try {
      const processors = await this.factory.getAvailableProcessors(true);
      const healthStatus = {
        overall: processors.some((p) => p.available) ? 'healthy' : 'unhealthy',
        processors: processors,
        timestamp: new Date().toISOString(),
      };

      return healthStatus;
    } catch (error: any) {
      return {
        overall: 'error',
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Configuration Management Examples
 */
export class PaymentConfigurationManager {
  /**
   * Disable a processor (useful for maintenance)
   */
  static disableProcessor(processorName: string) {
    PaymentProcessorFactory.setProcessorEnabled(processorName, false);
    console.log(`Disabled processor: ${processorName}`);
  }

  /**
   * Change processor priority (lower number = higher priority)
   */
  static prioritizeProcessor(processorName: string, priority: number) {
    PaymentProcessorFactory.setProcessorPriority(processorName, priority);
    console.log(`Set ${processorName} priority to ${priority}`);
  }

  /**
   * Emergency fallback to single processor
   */
  static setEmergencyMode(preferredProcessor: string) {
    // Disable all processors except the preferred one
    PaymentProcessorFactory.setProcessorEnabled('stripe', false);
    PaymentProcessorFactory.setProcessorEnabled('pyre', false);

    // Enable only the preferred processor
    PaymentProcessorFactory.setProcessorEnabled(preferredProcessor, true);

    console.log(`Emergency mode: Only ${preferredProcessor} enabled`);
  }
}

// Usage examples:

/*
// Example usage in your billing handler:
const paymentService = new PaymentService();

// Smart selection
const result = await paymentService.processPaymentSmart(29.99, 'customer_123');

// With preferences
const result2 = await paymentService.processPaymentWithPreferences(29.99, 'customer_123');

// Health check for monitoring
const health = await paymentService.getPaymentSystemHealth();

// Configuration management
PaymentConfigurationManager.prioritizeProcessor('stripe', 1); // Make Stripe highest priority
PaymentConfigurationManager.disableProcessor('pyre'); // Disable Pyre temporarily
*/
