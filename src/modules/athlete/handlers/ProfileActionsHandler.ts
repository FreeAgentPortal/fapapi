import { Request } from 'express';
import { IAthlete } from '../models/AthleteModel';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import BillingAccount from '../../auth/model/BillingAccount';
import { AthleteProfileHandler } from './AtheleteProfileHandler';
import { CRUDHandler } from '../../../utils/baseCRUD';

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class ProfileActionsHandler {
  async getProfile(data: any): Promise<IAthlete> {
    const crudHandler = new AthleteProfileHandler();
    const profile = await crudHandler.fetch(data.id);
    if (!profile) throw new ErrorUtil('Unable to fetch Profile', 400);
    const billing = await BillingAccount.findOne({ profileId: profile._id });
    if (!billing) {
      throw new ErrorUtil('billing information not found', 400);
    }
    return {
      ...profile,
      needsBillingSetup: billing.needsUpdate,
    } as any as IAthlete;
  }

  async populateFromEspn(playerid: string): Promise<IAthlete> {
    const crudHandler = new AthleteProfileHandler();
    const profile = await crudHandler.fetch(playerid);
    if (!profile) throw new ErrorUtil('Unable to fetch Profile', 400);

    // 1. Query ESPN API for player data
    try {
      const espnResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${playerid}`);
      if (!espnResponse.ok) {
        throw new ErrorUtil('Failed to fetch data from ESPN', 400);
      }
      const espnData = await espnResponse.json();
      // 2. Map ESPN data to profile fields
      const mappedProfile = await mapAthleteData(espnData);
      // 3. Update profile with ESPN data
      Object.assign(profile, mappedProfile);
      // 4. Save profile
      await crudHandler.update(profile._id, profile);
      // 5. Return updated profile
      return profile;
    } catch (err) {
      throw new ErrorUtil('Failed to populate profile from ESPN', 400);
    }
  }
}
const mapAthleteData = (data: any) => ({
  espnid: data.id,
  fullName: data.fullName,
  firstName: data.firstName,
  lastName: data.lastName,
  displayName: data.displayName,
  age: data.age,
  birthdate: data.dateOfBirth,
  active: data.active,
  measurements: {
    height: data.height,
    weight: data.weight,
  },
  metrics: {},
  birthPlace: data.birthPlace,
  draft: data.draft
    ? {
        year: data.draft.year,
        round: data.draft.round,
        selection: data.draft.selection,
        displayText: data.draft.displayText,
      }
    : undefined,
  positions: {
    name: data.position?.name,
    abbreviation: data.position?.abbreviation,
  },
  experienceYears: data.experience?.years,
  profileImageUrl: data.headshot?.href,
  links: data.links?.map((link: any) => ({
    text: link.text,
    shortText: link.shortText,
    href: link.href,
    rel: link.rel,
    isExternal: link.isExternal,
  })),
});
