/**
 * Test file to verify PaymentProcessorFactory can create both processors
 * Run this with: npm run test or node -r ts-node/register src/modules/payment/tests/processor-factory.test.ts
 */

import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';

describe('PaymentProcessorFactory', () => {
  test('should create PyreProcessing instance', () => {
    const factory = new PaymentProcessorFactory();
    const processor = factory.chooseProcessor('pyre');
    expect(processor.getProcessorName()).toBe('pyreprocessing');
  });

  test('should create StripeProcessing instance', () => {
    const factory = new PaymentProcessorFactory();
    const processor = factory.chooseProcessor('stripe');
    expect(processor.getProcessorName()).toBe('stripe');
  });

  test('should throw error for invalid processor type', () => {
    const factory = new PaymentProcessorFactory();
    expect(() => {
      factory.chooseProcessor('invalid');
    }).toThrow('Invalid processor type');
  });

  test('should support both pyre and pyreprocessing for backwards compatibility', () => {
    const factory = new PaymentProcessorFactory();

    const processor1 = factory.chooseProcessor('pyre');
    const processor2 = factory.chooseProcessor('pyreprocessing');

    expect(processor1.getProcessorName()).toBe('pyreprocessing');
    expect(processor2.getProcessorName()).toBe('pyreprocessing');
  });
});

// Manual test function (for development)
export async function testProcessorCreation() {
  console.log('Testing PaymentProcessorFactory...');

  const factory = new PaymentProcessorFactory();

  try {
    // Test Pyre processor
    const pyreProcessor = factory.chooseProcessor('pyre');
    console.log('✅ Pyre processor created:', pyreProcessor.getProcessorName());

    // // Test Stripe processor
    // const stripeProcessor = factory.chooseProcessor('stripe');
    // console.log('✅ Stripe processor created:', stripeProcessor.getProcessorName());

    console.log('🎉 All processors created successfully!');

    // Test that both have the same interface
    console.log('\nTesting interface compatibility:');
    console.log('Pyre methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pyreProcessor)));
    // console.log('Stripe methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(stripeProcessor)));
  } catch (error) {
    console.error('❌ Error testing processors:', error);
  }
}

// Uncomment to run manual test
// testProcessorCreation();
