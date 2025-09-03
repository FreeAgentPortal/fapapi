import PaynetworxProcessor from "../classes/paynetworx";
import PyreProcessing from "../classes/PyreProcessor";

/**
 * @description PaymentProcessorFactory class, this class is responsible for creating
 *              instances of the different payment processors. based on conditions
 *              passed to the createProcessor method. via a processorType parameter.
 * @class PaymentProcessorFactory
 * @version 1.0.0
 * @since 1.0.0
 *
 */
class PaymentProcessorFactory {
  /**
   * @description createProcessor method, this method creates and returns an instance of a payment processor
   *              based on the processorType parameter passed to it.
   * @param {string} processorType - the type of processor to create.
   * @returns {PaymentProcessor} - an instance of a payment processor.
   */
  chooseProcessor(processorType: string) {
    switch (processorType) {
      case "pyre":
        return new PyreProcessing();
      case "paynetworx":
        return new PaynetworxProcessor();
      default:
        throw new Error("Invalid processor type");
    }
  }
}

export default PaymentProcessorFactory;
