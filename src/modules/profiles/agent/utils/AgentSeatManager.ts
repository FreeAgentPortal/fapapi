import BillingAccount from '../../../auth/model/BillingAccount';
import { FeatureType } from '../../../auth/model/FeatureSchema';
import { PlanType } from '../../../auth/model/PlanSchema';
import { AgentAthleteAssignmentModel } from '../model/AgentAthleteAssignment';
import { AgentProfileModel } from '../model/AgentProfile';

const SEAT_REGEX = /(\d+)\s*(?:athlete|agent)?\s*seats?/i;

type SeatSource = 'profile_override' | 'billing_entitlement' | 'billing_feature' | 'unconfigured';

export interface AgentSeatSummary {
  seatLimit: number;
  seatsUsed: number;
  seatsAvailable: number;
  source: SeatSource;
}

export class AgentSeatManager {
  static async getSeatSummary(agentProfileId: string): Promise<AgentSeatSummary> {
    const [agentProfile, seatsUsed, billingAccount] = await Promise.all([
      AgentProfileModel.findById(agentProfileId).lean(),
      AgentAthleteAssignmentModel.countDocuments({
        agentProfile: agentProfileId,
        status: { $in: ['pending', 'accepted'] },
      }),
      BillingAccount.findOne({ profileId: agentProfileId })
        .populate('features')
        .populate({
          path: 'plan',
          populate: { path: 'features' },
        }),
    ]);

    const { seatLimit, source } = this.resolveSeatLimit(agentProfile, billingAccount as any);

    return {
      seatLimit,
      seatsUsed,
      seatsAvailable: Math.max(seatLimit - seatsUsed, 0),
      source,
    };
  }

  private static resolveSeatLimit(agentProfile: any, billingAccount: any): { seatLimit: number; source: SeatSource } {
    if (typeof agentProfile?.seatLimitOverride === 'number') {
      return { seatLimit: agentProfile.seatLimitOverride, source: 'profile_override' };
    }

    const structuredSeatLimit = billingAccount?.entitlements?.agentSeats;
    if (typeof structuredSeatLimit === 'number') {
      return { seatLimit: structuredSeatLimit, source: 'billing_entitlement' };
    }

    const billingFeatures = Array.isArray(billingAccount?.features) ? billingAccount.features : [];
    for (const feature of billingFeatures) {
      const parsed = this.extractSeatLimit(feature);
      if (parsed !== null) {
        return { seatLimit: parsed, source: 'billing_feature' };
      }
    }

    const planFeatures = Array.isArray((billingAccount?.plan as PlanType | undefined)?.features) ? (billingAccount?.plan as PlanType).features : [];
    for (const feature of planFeatures) {
      const parsed = this.extractSeatLimit(feature);
      if (parsed !== null) {
        return { seatLimit: parsed, source: 'billing_feature' };
      }
    }

    const plan = billingAccount?.plan as Partial<PlanType> | undefined;
    const planValues = [plan?.name, plan?.description].filter(Boolean) as string[];
    for (const value of planValues) {
      const match = value.match(SEAT_REGEX);
      if (match) {
        return { seatLimit: Number(match[1]), source: 'billing_feature' };
      }
    }

    return { seatLimit: 0, source: 'unconfigured' };
  }

  private static extractSeatLimit(feature: Partial<FeatureType> | null | undefined): number | null {
    if (!feature) {
      return null;
    }

    const values = [feature.name, feature.shortDescription, feature.detailedDescription].filter(Boolean) as string[];
    for (const value of values) {
      const match = value.match(SEAT_REGEX);
      if (match) {
        return Number(match[1]);
      }
    }

    return null;
  }
}
