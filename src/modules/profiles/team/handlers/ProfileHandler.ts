import { Request } from 'express';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import User from '../../../auth/model/User';
import TeamModel, { ITeamProfile } from '../model/TeamModel';
import crypto from 'crypto';
import { CRUDHandler } from '../../../../utils/baseCRUD';
import mongoose, { Types } from 'mongoose';
import { ModelMap } from '../../../../utils/ModelMap';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';

export default class TeamProfileHandler extends CRUDHandler<ITeamProfile> {
  private modelMap: Record<string, any>;
  constructor() {
    super(TeamModel);
    this.modelMap = ModelMap;
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

  /**
   * @Description Creates a new team in the database and creates a hashed token for easy claim process
   */
  async inviteTeam(data: ITeamProfile): Promise<ITeamProfile> {
    // Create a new team profile
    const team = await this.create({
      ...data,
      claimToken: this.generateClaimToken(),
      claimTokenExpiresAt: this.generateClaimTokenExpiresAt(),
    });

    return team;
  }

  async attach(teamId: string, userId: Types.ObjectId): Promise<void> {
    // Check if user is already linked to this team
    const existingLink = await this.Schema.findOne({
      _id: teamId,
      'linkedUsers.user': userId,
    });

    if (existingLink) {
      console.log(`User ${userId} is already linked to team ${teamId}`);
      // Still update the user's profile ref and clear tokens
      await this.Schema.findByIdAndUpdate(teamId, {
        // $unset: { claimToken: '', claimTokenExpiresAt: '' },
      });
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
      // $unset: { claimToken: '', claimTokenExpiresAt: '' },
    });
    await this.modelMap['user'].findByIdAndUpdate(userId, {
      $set: { 'profileRefs.team': teamId },
    });
  }

  async validateToken(token: string): Promise<{ isValid: boolean; team: ITeamProfile | null }> {
    const team = await this.Schema.findOne({ claimToken: token, claimTokenExpiresAt: { $gt: new Date() } });
    if (!team) throw new ErrorUtil('Invalid or expired token', 400);
    return { isValid: !!team, team };
  }

  private generateClaimToken(): string {
    // Implementation for generating a claim token
    const token = crypto.randomBytes(20).toString('hex');
    // hash token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    return hashedToken;
  }

  private generateClaimTokenExpiresAt(): Date {
    // Implementation for generating token expiration date
    const now = new Date();
    now.setHours(now.getHours() + 48); // Token expires in 48 hours
    return now;
  }
}
