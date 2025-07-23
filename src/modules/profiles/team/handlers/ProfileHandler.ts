import { Request } from 'express';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import User from '../../../auth/model/User';
import TeamModel, { ITeamProfile } from '../model/TeamModel'; 
import { CRUDHandler } from '../../../../utils/baseCRUD';

export default class TeamProfileHandler extends CRUDHandler<ITeamProfile> {
  constructor() {
    super(TeamModel);
  }
  async createProfile(data: { name: string; email: string; phone?: string; userId: string }) {
    const { name, email, phone, userId } = data;

    // Check if user already has a profile
    const existing = await TeamModel.findOne({ linkedUsers: userId });
    if (existing) {
      throw new Error('User already linked to a team profile');
    }

    const profile = await TeamModel.create({
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
}
