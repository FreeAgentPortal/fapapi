import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { IScout, ScoutModel } from '../model/ScoutProfile';

export class ScoutProfileActionsHandler {
  Schema = ScoutModel;

  /**
   * Handles adding/removing favorited athletes for a scout profile.
   * @param {string} scoutId - The ID of the scout profile.
   * @param {string} athleteId - The ID of the athlete to favorite/unfavorite.
   * @returns {Promise<IScout>} - The updated scout profile.
   */
  async toggleFavoriteAthlete(scoutId: string, athleteId: string): Promise<IScout> {
    try {
      const scoutProfile = await this.Schema.findById(scoutId);
      if (!scoutProfile) {
        throw new ErrorUtil('Scout profile not found', 404);
      }
      // Ensure favoritedAthletes is initialized as an array
      if (!Array.isArray(scoutProfile.favoritedAthletes)) {
        scoutProfile.favoritedAthletes = [];
      }
      // check the favoritedAthletes array to see if the athlete is already favorited, if it is, remove it, otherwise add it
      const index = scoutProfile.favoritedAthletes.indexOf(athleteId as any);
      if (index > -1) {
        // Athlete is already favorited, remove it
        scoutProfile.favoritedAthletes.splice(index, 1);
      } else {
        // Athlete is not favorited, add it
        scoutProfile.favoritedAthletes.push(athleteId as any);
      }
      await scoutProfile.save();
      return scoutProfile;
    } catch (error) {
      console.error('[ScoutProfileActions] Error toggling favorite athlete:', error);
      throw new ErrorUtil('Failed to toggle favorite athlete', 500);
    }
  }
}
