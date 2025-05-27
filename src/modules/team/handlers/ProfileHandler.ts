import { Request } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import User from '../../auth/model/User';
import TeamModel, { ITeamProfile } from '../model/TeamModel';

export default class TeamProfileHandler {
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

  async getProfileById(id: string) {
    return TeamModel.findOne({ _id: id });
  }

  async updateProfile(req: Request & AuthenticatedRequest): Promise<ITeamProfile | null> {
    return await TeamModel.findOneAndUpdate({ userId: req.params.id }, req.body, {
      new: true,
      runValidators: true,
    });
  }

  async deleteProfile(req: Request & AuthenticatedRequest): Promise<boolean> {
    const deleted = await TeamModel.findOneAndDelete({
      _id: req.params.id,
      linkedUsers: req.user._id,
    });
    if (!deleted) throw new Error('Nothing to delete');
    return true;
  }

  /**
   * @description Retrieves all athlete profiles, useful for admin or public listings.
   * @returns An array of athlete profiles
   */
  async getAllProfiles(req: Request): Promise<ITeamProfile[]> {
    //TODO: Implement pagination and adv. filtering logic
    // For now, return all profiles
    return await TeamModel.find({});
  }
}
