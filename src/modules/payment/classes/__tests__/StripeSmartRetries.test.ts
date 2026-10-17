import Stripe from 'stripe';
import StripeProcessor from '../StripeProcessor';

jest.mock('stripe');

describe('Stripe scheduled charge results', () => {
  let create: jest.Mock;
  let processor: StripeProcessor;
  const details = { customer: { id: 'cus' }, amount: 8, paymentMethodId: 'pm', idempotencyKey: 'attempt-1', billingAccountId: 'billing', revenueCategory: 'subscription' };

  beforeEach(() => {
    create = jest.fn();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({ paymentIntents: { create } }));
    processor = new StripeProcessor();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('passes the claimed card and idempotency key and reports confirmed success', async () => {
    create.mockResolvedValue({ id: 'pi', status: 'succeeded' });
    const result = await processor.processPayment(details);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amount: 800, payment_method: 'pm', off_session: true }), { idempotencyKey: 'attempt-1' });
    expect(result).toMatchObject({ success: true, transactionId: 'pi', outcome: 'succeeded' });
  });

  it('preserves the structured insufficient-funds code and payment intent', async () => {
    create.mockRejectedValue({ type: 'StripeCardError', code: 'card_declined', decline_code: 'insufficient_funds', payment_intent: { id: 'pi_failed' }, message: 'Declined' });
    expect(await processor.processPayment(details)).toMatchObject({ success: false, declineCode: 'insufficient_funds', transactionId: 'pi_failed', outcome: 'declined' });
  });

  it('also handles decline information carried in Stripe raw error data', async () => {
    create.mockRejectedValue({ type: 'StripeCardError', raw: { decline_code: 'insufficient_funds', payment_intent: { id: 'pi_raw' } } });
    expect(await processor.processPayment(details)).toMatchObject({ declineCode: 'insufficient_funds', transactionId: 'pi_raw' });
  });

  it.each(['StripeConnectionError', 'StripeAPIError', undefined])('marks %s as an unknown outcome', async (type) => {
    create.mockRejectedValue({ type, message: 'Request interrupted' });
    expect(await processor.processPayment(details)).toMatchObject({ success: false, outcome: 'unknown' });
  });

  it('does not treat an asynchronous payment as a confirmed success for retries', async () => {
    create.mockResolvedValue({ id: 'pi', status: 'processing' });
    expect(await processor.processPayment(details)).toMatchObject({ status: 'processing', outcome: 'unknown' });
  });
});
