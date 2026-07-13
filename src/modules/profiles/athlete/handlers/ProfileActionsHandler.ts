import { Request } from 'express';
import { IAthlete } from '../models/AthleteModel';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import BillingAccount from '../../../auth/model/BillingAccount';
import { AthleteProfileHandler } from './AtheleteProfileHandler';
import { CRUDHandler } from '../../../../utils/baseCRUD';
import { BillingValidator } from '../../../../utils/billingValidation';
import logger from '../../../../utils/logger';

/**
 * Handles creation, retrieval, and modification of athlete profiles.
 */
export class ProfileActionsHandler {
  async getProfile(data: any): Promise<IAthlete> {
    logger.debug({ profileId: data.id }, 'getProfile: initiated');

    const crudHandler = new AthleteProfileHandler();
    const profile = await crudHandler.fetch(data.id);
    if (!profile) {
      logger.debug({ profileId: data.id }, 'getProfile: profile not found');
      throw new ErrorUtil('Unable to fetch Profile', 400);
    }
    logger.debug({ profileId: profile._id }, 'getProfile: profile fetched');

    const billing = await BillingAccount.findOne({ profileId: profile._id }).populate('plan');
    if (!billing) {
      logger.debug({ profileId: profile._id }, 'getProfile: billing account not found');
      throw new ErrorUtil('billing information not found', 400);
    }
    logger.debug({ profileId: profile._id, billingId: billing._id }, 'getProfile: billing account found');

    // Use the comprehensive billing validator
    const billingValidation = BillingValidator.validateBillingAccount(billing);
    const isAgentManaged = !!profile.agent?.profile && profile.agent?.status === 'active';
    logger.debug(
      { profileId: profile._id, isAgentManaged, billingNeedsUpdate: billingValidation.needsUpdate, billingSeverity: billingValidation.severity },
      'getProfile: billing validation complete'
    );

    return {
      ...profile,
      needsBillingSetup: isAgentManaged ? false : billingValidation.needsUpdate,
      billingValidation: isAgentManaged
        ? {
            ...billingValidation,
            needsUpdate: false,
            severity: 'info',
            reasons: ['Athlete is currently represented by an active agent seat'],
            recommendations: [],
          }
        : billingValidation,
    } as any as IAthlete;
  }

  async populateFromEspn(playerid: string): Promise<IAthlete> {
    logger.debug({ playerid }, 'populateFromEspn: initiated');

    const crudHandler = new AthleteProfileHandler();
    const profile = await crudHandler.fetch(playerid);
    if (!profile) {
      logger.debug({ playerid }, 'populateFromEspn: profile not found');
      throw new ErrorUtil('Unable to fetch Profile', 400);
    }
    logger.debug({ profileId: profile._id, playerid }, 'populateFromEspn: profile fetched');

    // 1. Query ESPN API for player data
    try {
      logger.debug({ playerid }, 'populateFromEspn: requesting ESPN API');
      const espnResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${playerid}`);
      if (!espnResponse.ok) {
        logger.debug({ playerid, status: espnResponse.status }, 'populateFromEspn: ESPN API responded with error status');
        throw new ErrorUtil('Failed to fetch data from ESPN', 400);
      }
      logger.debug({ playerid, status: espnResponse.status }, 'populateFromEspn: ESPN API response received');

      const espnData = await espnResponse.json();
      logger.debug({ playerid, espnId: espnData?.id }, 'populateFromEspn: ESPN data parsed');

      // 2. Map ESPN data to profile fields
      const mappedProfile = mapAthleteData(espnData);
      logger.debug({ playerid }, 'populateFromEspn: ESPN data mapped to profile shape');

      // 3. Only update fields that are not already set by the user
      const updatedProfile = mergeWithExistingData(profile, mappedProfile);
      logger.debug({ playerid }, 'populateFromEspn: merged ESPN data with existing profile');

      // 4. Save profile with merged data
      await crudHandler.update(profile._id, updatedProfile);
      logger.debug({ profileId: profile._id, playerid }, 'populateFromEspn: profile updated in database');

      // 5. Return updated profile
      return updatedProfile;
    } catch (err) {
      logger.debug({ playerid, err }, 'populateFromEspn: error during ESPN population');
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
