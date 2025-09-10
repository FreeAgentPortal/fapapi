import { Request } from 'express';
import { IAthlete } from '../models/AthleteModel';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import BillingAccount from '../../../auth/model/BillingAccount';
import { AthleteProfileHandler } from './AtheleteProfileHandler';
import { CRUDHandler } from '../../../../utils/baseCRUD';
import { BillingValidator } from '../../../../utils/billingValidation';

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

    // Use the comprehensive billing validator
    const billingValidation = BillingValidator.validateBillingAccount(billing);
    console.log('Billing validation result:', billingValidation);

    return { 
      ...profile,
      needsBillingSetup: billingValidation.needsUpdate,
      billingValidation,
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
      const mappedProfile = mapAthleteData(espnData);

      // 3. Only update fields that are not already set by the user
      const updatedProfile = mergeWithExistingData(profile, mappedProfile);

      // 4. Save profile with merged data
      await crudHandler.update(profile._id, updatedProfile);

      // 5. Return updated profile
      return updatedProfile;
    } catch (err) {
      throw new ErrorUtil('Failed to populate profile from ESPN', 400);
    }
  }
}

/**
 * Merges ESPN data with existing profile data, preserving user-provided data
 * @param existingProfile - Current athlete profile from database
 * @param espnData - Mapped data from ESPN API
 * @returns Merged profile with preserved user data
 */
const mergeWithExistingData = (existingProfile: any, espnData: any): any => {
  const merged = { ...existingProfile };

  // Helper function to check if a value is considered "empty" or not set by user
  const isEmpty = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  };

  // Helper function to merge objects (for nested fields like measurements, birthPlace)
  const mergeObject = (existing: any, incoming: any): any => {
    if (isEmpty(existing)) return incoming;
    if (isEmpty(incoming)) return existing;

    const result = { ...existing };
    Object.keys(incoming).forEach((key) => {
      if (isEmpty(existing[key])) {
        result[key] = incoming[key];
      }
    });
    return result;
  };

  // Merge simple fields - only if existing field is empty
  Object.keys(espnData).forEach((key) => {
    if (key === 'measurements' || key === 'birthPlace' || key === 'draft' || key === 'positions') {
      // Handle nested objects specially
      merged[key] = mergeObject(existingProfile[key], espnData[key]);
    } else if (key === 'links') {
      // For arrays like links, only set if existing is empty
      if (isEmpty(existingProfile[key])) {
        merged[key] = espnData[key];
      }
    } else {
      // For simple fields, only override if existing is empty
      if (isEmpty(existingProfile[key])) {
        merged[key] = espnData[key];
      }
    }
  });

  return merged;
};

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
