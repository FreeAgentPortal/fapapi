export const SUBSCRIPTION_REVENUE_CATEGORIES = ['subscription', 'subscription_proration'] as const;

export type ReceiptRevenueCategory =
  | (typeof SUBSCRIPTION_REVENUE_CATEGORIES)[number]
  | 'setup_fee'
  | 'other';

const LEGACY_SUBSCRIPTION_DESCRIPTION = /(subscription|prorated upgrade charge)/i;

export function buildSubscriptionReceiptQuery(start: Date, end: Date, options: { successfulOnly?: boolean; stripeOnly?: boolean } = {}) {
  const query: Record<string, any> = {
    transactionDate: { $gte: start, $lt: end },
    type: 'payment',
    $or: [
      { revenueCategory: { $in: SUBSCRIPTION_REVENUE_CATEGORIES } },
      { description: LEGACY_SUBSCRIPTION_DESCRIPTION },
    ],
  };

  if (options.successfulOnly) {
    query.status = { $in: ['success', 'succeeded', 'completed'] };
  }
  if (options.stripeOnly) {
    query['processor.name'] = 'stripe';
  }

  return query;
}

export function isSubscriptionProration(receipt: { revenueCategory?: string; description?: string | null }): boolean {
  return receipt.revenueCategory === 'subscription_proration' || /prorated upgrade charge/i.test(receipt.description ?? '');
}
