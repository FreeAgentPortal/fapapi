import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import BillingAccount from '../../../auth/model/BillingAccount';
import PlanSchema from '../../../auth/model/PlanSchema';
import User from '../../../auth/model/User';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import { AgentAthleteAssignmentModel, IAgentAthleteAssignment } from '../model/AgentAthleteAssignment';
import { AgentProfileModel } from '../model/AgentProfile';
import { AgentSeatManager } from '../utils/AgentSeatManager';

const AGENT_ASSISTED_ATHLETE_PLAN_ID = '6a3c0c03d7a936f2c0e3ae20';

export class AgentRosterHandler {
  async getRoster(agentProfileId: string): Promise<IAgentAthleteAssignment[]> {
    return await AgentAthleteAssignmentModel.find({
      agentProfile: agentProfileId,
      status: { $in: ['pending', 'accepted'] },
    })
      .populate('athleteProfile', '_id fullName email profileImageUrl positions isActive agent')
      .sort({ createdAt: -1 });
  }

  async getSeatSummary(agentProfileId: string) {
    return await AgentSeatManager.getSeatSummary(agentProfileId);
  }

  async inviteAthlete(agentProfileId: string, invitedBy: string, data: { athleteId?: string; athleteEmail?: string; message?: string }) {
    const summary = await AgentSeatManager.getSeatSummary(agentProfileId);
    if (summary.seatsAvailable <= 0) {
      throw new ErrorUtil(
        summary.source === 'unconfigured'
          ? 'Agent seat limit is not configured on the current subscription plan.'
          : 'Agent seat limit reached. Remove or resolve an active athlete seat before inviting another athlete.',
        400
      );
    }

    const athlete = await this.resolveAthlete(data);
    if (!athlete) {
      throw new ErrorUtil('Athlete not found. Invites require an already-registered athlete profile.', 404);
    }

    if (athlete.agent?.profile && athlete.agent.profile.toString() !== agentProfileId && athlete.agent.status === 'active') {
      throw new ErrorUtil('Athlete is already represented by another agent.', 400);
    }

    const existing = await AgentAthleteAssignmentModel.findOne({
      agentProfile: agentProfileId,
      athleteProfile: athlete._id,
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      throw new ErrorUtil('This athlete already has an active invitation or roster assignment for the agent.', 400);
    }

    return await AgentAthleteAssignmentModel.create({
      agentProfile: agentProfileId,
      athleteProfile: athlete._id,
      athleteUser: athlete.userId,
      invitedBy,
      status: 'pending',
      message: data.message,
      invitedAt: new Date(),
    });
  }

  async getAthleteInvitations(athleteProfileId: string): Promise<IAgentAthleteAssignment[]> {
    return await AgentAthleteAssignmentModel.find({
      athleteProfile: athleteProfileId,
      status: 'pending',
    })
      .populate('agentProfile', '_id displayName agencyName headline organization location sports specialties certifications email contactNumber slug socialLinks')
      .sort({ createdAt: -1 });
  }

  async getAthleteInvitationCount(athleteProfileId: string): Promise<number> {
    return await AgentAthleteAssignmentModel.countDocuments({
      athleteProfile: athleteProfileId,
      status: 'pending',
    });
  }

  async respondToInvitation(athleteProfileId: string, invitationId: string, action: 'accept' | 'decline') {
    if (!['accept', 'decline'].includes(action)) {
      throw new ErrorUtil('Invitation action must be accept or decline.', 400);
    }
 
    const invitation = await AgentAthleteAssignmentModel.findById(invitationId); 
    if (!invitation || invitation.athleteProfile.toString() !== athleteProfileId.toString()) {
      throw new ErrorUtil('Invitation not found.', 404);
    }
    if (invitation.status !== 'pending') {
      throw new ErrorUtil('Invitation is no longer pending.', 400);
    }

    if (action === 'decline') {
      invitation.status = 'declined';
      invitation.respondedAt = new Date();
      await invitation.save();
      return invitation;
    }

    const [athlete, agentProfile] = await Promise.all([AthleteModel.findById(athleteProfileId), AgentProfileModel.findById(invitation.agentProfile)]);
    if (!athlete || !agentProfile) {
      throw new ErrorUtil('Unable to resolve the athlete or agent for this invitation.', 404);
    }

    if (athlete.agent?.profile && athlete.agent.profile.toString() !== invitation.agentProfile.toString() && athlete.agent.status === 'active') {
      throw new ErrorUtil('Athlete already has an active agent.', 400);
    }

    const billingAssignment = await this.prepareAgentAssistedPlanAssignment(athlete._id.toString());

    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    invitation.acceptedAt = new Date();
    await invitation.save();

    athlete.agent = {
      name: agentProfile.displayName || agentProfile.agencyName,
      email: agentProfile.email,
      phone: agentProfile.contactNumber,
      profile: agentProfile._id,
      status: 'active',
      invitedAt: invitation.invitedAt,
      acceptedAt: invitation.acceptedAt,
    } as any;
    athlete.isActive = true;
    await athlete.save();

    await this.assignAgentAssistedPlan(billingAssignment.billing, billingAssignment.plan);

    await AgentAthleteAssignmentModel.updateMany(
      {
        athleteProfile: athlete._id,
        _id: { $ne: invitation._id },
        status: 'pending',
      },
      {
        $set: {
          status: 'declined',
          respondedAt: new Date(),
        },
      }
    );

    return invitation;
  }

  async removeAthlete(agentProfileId: string, assignmentId: string) {
    const assignment = await AgentAthleteAssignmentModel.findById(assignmentId);
    if (!assignment || assignment.agentProfile.toString() !== agentProfileId) {
      throw new ErrorUtil('Roster assignment not found.', 404);
    }
    return await this.removeAssignment(assignment, {
      agentProfileId,
      athleteIsActive: false,
    });
  }

  async removeMyAgent(athleteProfileId: string) {
    const athlete = await AthleteModel.findById(athleteProfileId);
    if (!athlete || !athlete.agent?.profile || athlete.agent.status !== 'active') {
      throw new ErrorUtil('Athlete does not have an active agent representation.', 404);
    }

    const assignment = await AgentAthleteAssignmentModel.findOne({
      athleteProfile: athleteProfileId,
      agentProfile: athlete.agent.profile,
      status: 'accepted',
    });

    if (!assignment) {
      throw new ErrorUtil('Active agent assignment not found.', 404);
    }

    return await this.removeAssignment(assignment, {
      agentProfileId: athlete.agent.profile.toString(),
    });
  }

  private async resolveAthlete(data: { athleteId?: string; athleteEmail?: string }) {
    if (data.athleteId) {
      return await AthleteModel.findById(data.athleteId);
    }

    if (data.athleteEmail) {
      const user = await User.findOne({ email: data.athleteEmail.toLowerCase().trim() }).lean();
      const athleteProfileId = user?.profileRefs?.athlete;
      if (!athleteProfileId) {
        return null;
      }
      return await AthleteModel.findById(athleteProfileId);
    }

    throw new ErrorUtil('athleteId or athleteEmail is required.', 400);
  }

  private async removeAssignment(
    assignment: IAgentAthleteAssignment,
    options: { agentProfileId: string; athleteIsActive?: boolean }
  ) {
    if (!['pending', 'accepted'].includes(assignment.status)) {
      throw new ErrorUtil('Only pending or accepted roster assignments can be removed.', 400);
    }

    const removedAt = new Date();
    assignment.status = 'removed';
    assignment.removedAt = removedAt;
    assignment.respondedAt = removedAt;
    await assignment.save();

    if (!assignment.acceptedAt) {
      return assignment;
    }

    const athlete = await AthleteModel.findById(assignment.athleteProfile);
    if (athlete && athlete.agent?.profile?.toString() === options.agentProfileId) {
      athlete.agent = {
        ...athlete.agent,
        profile: undefined,
        status: 'removed',
        removedAt,
      } as any;

      if (typeof options.athleteIsActive === 'boolean') {
        athlete.isActive = options.athleteIsActive;
      }

      await athlete.save();
    }

    await this.clearAgentAssistedPlan(assignment.athleteProfile.toString());

    return assignment;
  }

  private async prepareAgentAssistedPlanAssignment(athleteProfileId: string) {
    const [billing, plan] = await Promise.all([
      BillingAccount.findOne({ profileId: athleteProfileId }),
      PlanSchema.findById(AGENT_ASSISTED_ATHLETE_PLAN_ID).lean(),
    ]);

    if (!billing) {
      throw new ErrorUtil('Billing information not found for athlete.', 404);
    }

    if (!plan || !plan.isActive) {
      throw new ErrorUtil('Configured agent-assisted athlete plan is not available.', 500);
    }

    return { billing, plan };
  }

  private async assignAgentAssistedPlan(billing: any, plan: any) {
    billing.plan = plan._id as any;
    billing.features = Array.isArray(plan.features) ? plan.features.map((featureId: any) => featureId as any) : [];
    billing.needsUpdate = false;
    billing.status = 'active';

    await billing.save();
  }

  private async clearAgentAssistedPlan(athleteProfileId: string) {
    const billing = await BillingAccount.findOne({ profileId: athleteProfileId });
    if (!billing) {
      return;
    }

    const isAgentAssistedPlan =
      billing.plan && billing.plan.toString() === AGENT_ASSISTED_ATHLETE_PLAN_ID;

    billing.needsUpdate = true;
    billing.status = 'inactive';

    if (isAgentAssistedPlan) {
      billing.plan = undefined as any;
      billing.features = [];
      billing.entitlements = undefined;
    }

    await billing.save();
  }
}
