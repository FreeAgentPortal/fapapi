import User from '../../../auth/model/User';
import TeamModel, { ITeamProfile } from '../model/TeamModel';
import { CRUDHandler } from '../../../../utils/baseCRUD';
import { Types } from 'mongoose';
import { ModelMap } from '../../../../utils/ModelMap';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { IAthlete } from '../../athlete/models/AthleteModel';

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
      console.info(`[ProfileHandler]: User ${userId} is already linked to team ${teamId}`);

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

  protected async afterDelete(doc: ITeamProfile | null): Promise<void> {
    if (!doc) return;

    for (const user of doc.linkedUsers) {
      // we need to remove the linked user's profileRef, ONLY IF the profile reference exists, and is the id of the team removed
      const u = await this.modelMap['user'].findOne({
        _id: user.user,
        'profileRefs.team': doc._id,
      });

      // if user is found with a reference to this profile, remove the profileRef
      if (u) {
        await this.modelMap['user'].findByIdAndUpdate(user.user, {
          $pull: { 'profileRefs.team': doc._id },
        });
      }
    }
  }

  /**
   * Handles adding/removing favorited athletes for a team profile.
   * @param {string} teamId - The ID of the scout profile.
   * @param {string} athleteId - The ID of the athlete to favorite/unfavorite.
   * @returns {Promise<IScout>} - The updated scout profile.
   */
  async toggleFavoriteAthlete(teamId: string, athleteId: string): Promise<ITeamProfile> {
    try {
      const teamProfile = await this.Schema.findById(teamId);
      if (!teamProfile) {
        throw new ErrorUtil('Scout profile not found', 404);
      }
      // Ensure favoritedAthletes is initialized as an array
      if (!Array.isArray(teamProfile.favoritedAthletes)) {
        teamProfile.favoritedAthletes = [];
      }
      // check the favoritedAthletes array to see if the athlete is already favorited, if it is, remove it, otherwise add it
      const index = teamProfile.favoritedAthletes.indexOf(athleteId as any);
      if (index > -1) {
        // Athlete is already favorited, remove it
        teamProfile.favoritedAthletes.splice(index, 1);
      } else {
        // Athlete is not favorited, add it
        teamProfile.favoritedAthletes.push(athleteId as any);
      }
      await teamProfile.save();
      return teamProfile;
    } catch (error) {
      console.error('[TeamProfileActions] Error toggling favorite athlete:', error);
      throw new ErrorUtil('Failed to toggle favorite athlete', 500);
    }
  }

  async fetchFavoritedAthletes(teamId: string): Promise<IAthlete[]> {
    try {
      const teamProfile = await this.Schema.findById(teamId).populate({
        path: 'favoritedAthletes',
        select: '_id fullName birthdate positions profileImageUrl diamondRating',
      });
      if (!teamProfile) {
        throw new ErrorUtil('Team profile not found', 404);
      }
      // Ensure favoritedAthletes is initialized as an array
      if (!Array.isArray(teamProfile.favoritedAthletes)) {
        teamProfile.favoritedAthletes = [] as any[];
      }

      return teamProfile.favoritedAthletes as unknown as IAthlete[];
    } catch (error) {
      console.error('[TeamProfileActions] Error fetching favorited athletes:', error);
      throw new ErrorUtil('Failed to fetch favorited athletes', 500);
    }
  }
}
