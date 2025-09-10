import PaynetworxProcessor from "../classes/paynetworx";
import PyreProcessing from "../classes/PyreProcessor";
import StripeProcessing from '../classes/StripeProcessor';

interface ProcessorConfig {
  name: string;
  priority: number;
  enabled: boolean;
  requiredEnvVars: string[];
  testConnection?: () => Promise<boolean>;
}

/**
 * @description PaymentProcessorFactory class, this class is responsible for creating
 *              instances of the different payment processors. It can dynamically choose
 *              the best available processor based on configuration and availability.
 * @class PaymentProcessorFactory
 * @version 2.0.0
 * @since 1.0.0
 */
class PaymentProcessorFactory {
  private static processorConfigs: ProcessorConfig[] = [
    {
      name: 'stripe',
      priority: 1, // Higher priority (preferred)
      enabled: true,
      requiredEnvVars: ['STRIPE_SECRET_KEY'],
      testConnection: async () => {
        try {
          const Stripe = require('stripe');
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-08-27.basil',
          });
          // Test connection by retrieving account info
          await stripe.accounts.retrieve();
          return true;
        } catch (error: any) {
          console.warn('[PaymentFactory] Stripe connection test failed:', error?.message || 'Unknown error');
          return false;
        }
      },
    },
    {
      name: 'pyre',
      priority: 2, // Lower priority (fallback)
      enabled: true,
      requiredEnvVars: ['PYRE_API_URL', 'PYRE_API_KEY'],
      testConnection: async () => {
        try {
          const axios = require('axios');
          // Simple health check to Pyre API
          const response = await axios.get(`${process.env.PYRE_API_URL}/health`, {
            headers: {
              'x-api-key': process.env.PYRE_API_KEY,
            },
            timeout: 5000,
          });
          return response.status === 200;
        } catch (error: any) {
          console.warn('[PaymentFactory] Pyre connection test failed:', error?.message || 'Unknown error');
          return false;
        }
      },
    },
  ];

  /**
   * @description chooseProcessor method - creates an instance based on explicit processor type
   * @param {string} processorType - the type of processor to create.
   * @returns {PaymentProcessor} - an instance of a payment processor.
   */
  chooseProcessor(processorType: string) {
    switch (processorType) {
      case 'pyre':
      case 'pyreprocessing':
        return new PyreProcessing();
      case "paynetworx":
        return new PaynetworxProcessor();
      case 'stripe':
        return new StripeProcessing();
      default:
        throw new Error(`Invalid processor type: ${processorType}`);
    }
  }

  /**
   * @description smartChooseProcessor - dynamically selects the best available processor
   * @param {object} options - configuration options
   * @param {string[]} options.preferredProcessors - list of preferred processors in order
   * @param {boolean} options.testConnections - whether to test connections (default: true)
   * @param {string} options.fallbackProcessor - processor to use if all preferred fail
   * @returns {Promise<{processor: PaymentProcessor, processorName: string, reason: string}>}
   */
  async smartChooseProcessor(
    options: {
      preferredProcessors?: string[];
      testConnections?: boolean;
      fallbackProcessor?: string;
    } = {}
  ) {
    const {
      preferredProcessors = [], // Empty means use priority order
      testConnections = true,
      fallbackProcessor = 'pyre',
    } = options;

    // Get processors to test, either from preferences or by priority
    let processorsToTest = preferredProcessors.length > 0 ? this.getProcessorsByPreference(preferredProcessors) : this.getProcessorsByPriority();

    // Test each processor in order
    for (const config of processorsToTest) {
      const availability = await this.testProcessorAvailability(config, testConnections);

      if (availability.available) {
        const processor = this.chooseProcessor(config.name);
        return {
          processor,
          processorName: config.name,
          reason: availability.reason,
        };
      }
    }

    // All preferred processors failed, try fallback
    console.warn('[PaymentFactory] All preferred processors unavailable, using fallback:', fallbackProcessor);
    const fallbackConfig = PaymentProcessorFactory.processorConfigs.find((c) => c.name === fallbackProcessor);

    if (fallbackConfig) {
      const availability = await this.testProcessorAvailability(fallbackConfig, false); // Skip connection test for fallback
      if (availability.configValid) {
        const processor = this.chooseProcessor(fallbackProcessor);
        return {
          processor,
          processorName: fallbackProcessor,
          reason: `Fallback processor - ${availability.reason}`,
        };
      }
    }

    throw new Error('No payment processors are available. Please check your configuration.');
  }

  /**
   * @description getAvailableProcessors - get list of all available processors
   * @param {boolean} testConnections - whether to test actual connections
   * @returns {Promise<{name: string, available: boolean, reason: string}[]>}
   */
  async getAvailableProcessors(testConnections: boolean = true) {
    const results = [];

    for (const config of PaymentProcessorFactory.processorConfigs) {
      const availability = await this.testProcessorAvailability(config, testConnections);
      results.push({
        name: config.name,
        priority: config.priority,
        available: availability.available,
        reason: availability.reason,
      });
    }

    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * @description Test if a processor is available and properly configured
   */
  private async testProcessorAvailability(config: ProcessorConfig, testConnection: boolean = true) {
    // Check if processor is enabled
    if (!config.enabled) {
      return { available: false, configValid: false, reason: `${config.name} is disabled` };
    }

    // Check required environment variables
    const missingEnvVars = config.requiredEnvVars.filter((envVar) => !process.env[envVar]);
    if (missingEnvVars.length > 0) {
      return {
        available: false,
        configValid: false,
        reason: `Missing environment variables: ${missingEnvVars.join(', ')}`,
      };
    }

    // If connection testing is disabled, return success
    if (!testConnection) {
      return { available: true, configValid: true, reason: 'Configuration valid (connection not tested)' };
    }

    // Test actual connection if available
    if (config.testConnection) {
      try {
        const connectionOk = await config.testConnection();
        if (connectionOk) {
          return { available: true, configValid: true, reason: 'Connection test passed' };
        } else {
          return { available: false, configValid: true, reason: 'Connection test failed' };
        }
      } catch (error: any) {
        return {
          available: false,
          configValid: true,
          reason: `Connection test error: ${error?.message || 'Unknown error'}`,
        };
      }
    }

    // No connection test available, assume available if config is valid
    return { available: true, configValid: true, reason: 'Configuration valid (no connection test available)' };
  }

  private getProcessorsByPreference(preferredProcessors: string[]): ProcessorConfig[] {
    const configs = [];
    for (const preferred of preferredProcessors) {
      const config = PaymentProcessorFactory.processorConfigs.find((c) => c.name === preferred);
      if (config) {
        configs.push(config);
      }
    }
    return configs;
  }

  private getProcessorsByPriority(): ProcessorConfig[] {
    return [...PaymentProcessorFactory.processorConfigs].sort((a, b) => a.priority - b.priority);
  }

  /**
   * @description Enable or disable a processor
   */
  static setProcessorEnabled(processorName: string, enabled: boolean) {
    const config = this.processorConfigs.find((c) => c.name === processorName);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * @description Update processor priority
   */
  static setProcessorPriority(processorName: string, priority: number) {
    const config = this.processorConfigs.find((c) => c.name === processorName);
    if (config) {
      config.priority = priority;
    }
  }
}

export default PaymentProcessorFactory;
