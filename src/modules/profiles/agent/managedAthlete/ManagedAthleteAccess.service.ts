import { ClientSession } from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import { AgentAthleteAssignmentModel, IAgentAthleteAssignment } from '../model/AgentAthleteAssignment';
import { AgentProfileModel, IAgentProfile } from '../model/AgentProfile';
import { AgentSeatManager } from '../utils/AgentSeatManager';
import { validatePathObjectId } from './ManagedAthleteValidation';

export type ManagedAthleteDenialReason =
  | 'assignment_inactive'
  | 'seat_inactive'
  | 'profile_unavailable'
  | 'not_authorized';

export interface ManagedAthleteAccessContext {
  actorUserId: string;
  agentProfile: IAgentProfile;
  athlete: any;
  assignment: IAgentAthleteAssignment;
  active: boolean;
  denialReason?: ManagedAthleteDenialReason;
}

export class ManagedAthleteAccessService {
  async resolve(
    actorUserId: string,
    agentProfileId: string,
    athleteId: string,
    options: { requireActive: boolean; session?: ClientSession }
  ): Promise<ManagedAthleteAccessContext> {
    validatePathObjectId(actorUserId, 'Authenticated user');
    validatePathObjectId(agentProfileId, 'Agent profile');
    validatePathObjectId(athleteId, 'athleteId');

    const agentQuery = AgentProfileModel.findOne({
      _id: agentProfileId,
      user: actorUserId,
      isActive: { $ne: false },
    });
    const athleteQuery = AthleteModel.findById(athleteId);
    const assignmentQuery = AgentAthleteAssignmentModel.findOne({
      agentProfile: agentProfileId,
      athleteProfile: athleteId,
    }).sort({ createdAt: -1 });

    if (options.session) {
      agentQuery.session(options.session);
      athleteQuery.session(options.session);
      assignmentQuery.session(options.session);
    }

    const [agentProfile, athlete, assignment] = options.session
      ? [await agentQuery, await athleteQuery, await assignmentQuery]
      : await Promise.all([agentQuery, athleteQuery, assignmentQuery]);

    if (!agentProfile) {
      throw new ErrorUtil('Authenticated user does not own an active agent profile.', 403);
    }
    if (!athlete) {
      throw new ErrorUtil('Athlete profile not found.', 404);
    }
    if (!assignment) {
      throw new ErrorUtil('Agent is not permitted to manage this athlete.', 403);
    }

    let denialReason: ManagedAthleteDenialReason | undefined;
    if (assignment.status !== 'accepted') {
      denialReason = 'assignment_inactive';
    } else if (
      athlete.agent?.status !== 'active' ||
      !athlete.agent?.profile ||
      athlete.agent.profile.toString() !== agentProfileId
    ) {
      denialReason = 'assignment_inactive';
    } else if (athlete.isActive === false || !athlete.userId) {
      denialReason = 'profile_unavailable';
    } else if (!(await AgentSeatManager.hasActiveRosterSeat(agentProfileId, options.session))) {
      denialReason = 'seat_inactive';
    }

    if (options.requireActive && denialReason) {
      throw new ErrorUtil('Delegated access to this athlete is no longer active.', 409);
    }

    return {
      actorUserId,
      agentProfile,
      athlete,
      assignment,
      active: !denialReason,
      denialReason,
    };
  }
}
