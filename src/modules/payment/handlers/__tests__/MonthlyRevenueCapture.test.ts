import cron from 'node-cron';
import { MonthlyRevenueForecastService } from '../../services/MonthlyRevenueForecastService';
import SmartRetriesService from '../../services/SmartRetriesService';
import PaymentProcessingHandler from '../PaymentProcessing.handler';
import { PaymentSchedulerCron } from '../../cron/PaymentScheduler.cron';

describe('monthly forecast capture entrypoints', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (PaymentProcessingHandler as any).processor = null;
  });

  it('captures before scheduled billing mutates account state, including manual runs', async () => {
    const order: string[] = [];
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(MonthlyRevenueForecastService, 'initializeSafely').mockImplementation(async () => { order.push('snapshot'); });
    jest.spyOn(SmartRetriesService, 'expireRetries').mockImplementation(async () => { order.push('expire'); });
    jest.spyOn(SmartRetriesService, 'reportBlockedAttempts').mockResolvedValue(undefined);
    jest.spyOn(PaymentProcessingHandler as any, 'applyDueScheduledPlanChanges').mockImplementation(async () => { order.push('plans'); return 0; });
    jest.spyOn(PaymentProcessingHandler, 'getProfilesDueForPayment').mockResolvedValue([]);
    jest.spyOn(PaymentProcessingHandler, 'getProfilesPendingCancellation').mockResolvedValue([]);
    (PaymentProcessingHandler as any).processor = {};
    expect((await PaymentProcessingHandler.processScheduledPayments()).success).toBe(true);
    expect(order).toEqual(['snapshot', 'expire', 'plans']);
  });

  it('registers startup and UTC month-boundary capture without changing the daily billing schedule', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const capture = jest.spyOn(MonthlyRevenueForecastService, 'initializeSafely').mockResolvedValue(undefined);
    const schedule = jest.spyOn(cron, 'schedule').mockReturnValue({} as any);
    PaymentSchedulerCron.init();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith('0 0 1 * *', expect.any(Function), {
      timezone: 'UTC', name: 'monthly-revenue-forecast',
    });
    expect(schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function), {
      timezone: 'America/Los_Angeles', name: 'payment-processing',
    });
    await (schedule.mock.calls[0][1] as () => Promise<void>)();
    expect(capture).toHaveBeenCalledTimes(2);
  });
});
