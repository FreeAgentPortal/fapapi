import User from '../../../auth/model/User';
import TeamModel, { ITeamProfile } from '../model/TeamModel';
import { CRUDHandler } from '../../../../utils/baseCRUD';
import { Types } from 'mongoose';
import { ModelMap } from '../../../../utils/ModelMap';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';

export default class TeamProfileHandler extends CRUDHandler<ITeamProfile> {
  private modelMap: Record<string, any>;
  constructor() {
    super(TeamModel);
    this.modelMap = ModelMap;
  }

  async fetch(id: string): Promise<any | null> {
    return await this.Schema.findById(id)
      .populate({
        path: 'linkedUsers.user',
        model: 'User',
      })
      .lean();
  }
  async createProfile(data: { name: string; email: string; phone?: string; userId: string }) {
    const { name, email, phone, userId } = data;

    // Check if user already has a profile
    const existing = await this.Schema.findOne({ linkedUsers: userId });
    if (existing) {
      throw new Error('User already linked to a team profile');
    }

    const profile = await this.Schema.create({
      name,
      email,
      phone,
      linkedUsers: [userId],
    });

    // Optionally update User record with reference
    await User.findByIdAndUpdate(userId, {
      $set: { 'profileRefs.team': profile._id },
    });

    return profile;
  }

  async attach(teamId: string, userId: Types.ObjectId): Promise<void> {
    // Check if user is already linked to this team
    const existingLink = await this.Schema.findOne({
      _id: teamId,
      'linkedUsers.user': userId,
    });

    if (existingLink) {
      console.log(`User ${userId} is already linked to team ${teamId}`);

      await this.modelMap['user'].findByIdAndUpdate(userId, {
        $set: { 'profileRefs.team': teamId },
      });

      return;
    }

    await this.Schema.findByIdAndUpdate(teamId, {
      $addToSet: {
        linkedUsers: {
          user: userId,
          role: 'member',
        },
      },
    });
    await this.modelMap['user'].findByIdAndUpdate(userId, {
      $set: { 'profileRefs.team': teamId },
    });
  }

  async validateToken(token: string): Promise<{ isValid: boolean; team: ITeamProfile | null; token: any }> {
    // find the token
    const doc = await this.modelMap['token'].validateRaw({
      rawToken: token,
      type: 'TEAM_INVITE',
    });

    // if no token is found, return early
    if (!doc) {
      throw new ErrorUtil('Invalid or expired token', 400);
    } 
    const team = await this.Schema.findOne({ _id: doc.teamProfile });
    if (!team) throw new ErrorUtil('Invalid or expired token', 400);
    return { isValid: !!team, team, token: doc };
  }
}
