import { applyBillingPlanSnapshot, buildBillingPlanSnapshot } from '../billingPlanUtils';

describe('billing plan entitlement snapshots', () => {
  it('preserves the monthly team-interest allowance in a plan snapshot', () => {
    const snapshot = buildBillingPlanSnapshot(
      { _id: 'plan-1', features: ['feature-1'] },
      { agentSeats: null, teamInterestsPerMonth: 10 },
      false
    );

    expect(snapshot.entitlements).toEqual({ agentSeats: null, teamInterestsPerMonth: 10 });
  });

  it('applies the allowance when a scheduled or immediate plan change takes effect', () => {
    const billing: any = { entitlements: { teamInterestsPerMonth: 3 } };
    applyBillingPlanSnapshot(billing, {
      plan: 'plan-elite',
      features: [],
      entitlements: { agentSeats: null, teamInterestsPerMonth: 25 },
      isYearly: true,
    });

    expect(billing.entitlements.teamInterestsPerMonth).toBe(25);
    expect(billing.isYearly).toBe(true);
  });

  it('keeps a missing entitlement dark by resolving it to null in generic snapshots', () => {
    const snapshot = buildBillingPlanSnapshot({ _id: 'plan-legacy', features: [] }, {}, false);
    expect(snapshot.entitlements.teamInterestsPerMonth).toBeNull();
  });
});
