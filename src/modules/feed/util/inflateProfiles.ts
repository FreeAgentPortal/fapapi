import mongoose from 'mongoose';
import logger from '../../../utils/logger';

export const FEED_PROFILE_TYPES = ['athlete', 'team', 'scout', 'professional', 'agent', 'admin'] as const;
export type FeedProfileType = (typeof FEED_PROFILE_TYPES)[number];

const PROFILE_COLLECTIONS: Record<FeedProfileType, string> = {
  athlete: 'athleteprofiles',
  team: 'teamprofiles',
  scout: 'scoutprofiles',
  professional: 'professional_profiles',
  agent: 'agentprofiles',
  admin: 'admins',
};

const PROFILE_PROJECTION = {
  _id: 1, fullName: 1, email: 1, profileImageUrl: 1, name: 1, logoUrl: 1,
  displayName: 1, avatarUrl: 1, agencyName: 1, 'organization.name': 1, user: 1,
};

type ProfileTarget = { object: any; type: string; id: string };

export const normalizeFeedProfileType = (type: string): string => type.trim().toLowerCase().replace(/profile$/, '');

const firstText = (...values: unknown[]): string | undefined => {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
};

/** Inflate display profiles without changing persisted references. Lookups are batched per collection. */
export async function inflateProfiles(targets: ProfileTarget[]): Promise<void> {
  const db = mongoose.connection.db;
  const resolved = new Map<ProfileTarget, { type: FeedProfileType; profile: any }>();
  const validTargets = targets.filter((target) => mongoose.Types.ObjectId.isValid(target.id));

  const findProfiles = async (type: FeedProfileType, candidates: ProfileTarget[]) => {
    if (!db || candidates.length === 0) return;
    try {
      const ids = [...new Set(candidates.map((target) => target.id))].map((id) => new mongoose.Types.ObjectId(id));
      const profiles = await db.collection(PROFILE_COLLECTIONS[type]).find({ _id: { $in: ids } }, { projection: PROFILE_PROJECTION }).toArray();
      const byId = new Map(profiles.map((profile) => [profile._id.toString(), profile]));
      for (const target of candidates) {
        const profile = byId.get(new mongoose.Types.ObjectId(target.id).toString());
        if (profile) resolved.set(target, { type, profile });
      }
    } catch (error) {
      logger.error({ err: error, profileType: type }, '[Feed] Failed to inflate profiles.');
    }
  };

  // Keep the existing platform identity for explicitly typed admin posts.
  for (const target of targets) {
    if (normalizeFeedProfileType(target.type) === 'admin') {
      resolved.set(target, { type: 'admin', profile: { _id: target.id } });
    }
  }

  for (const type of FEED_PROFILE_TYPES) {
    await findProfiles(type, validTargets.filter((target) => !resolved.has(target) && normalizeFeedProfileType(target.type) === type));
  }

  // Legacy composers used "athlete" even when sending an admin or another profile's ID.
  // Only recover through an exact profile ID match; never infer authorship from the viewer.
  for (const type of FEED_PROFILE_TYPES) {
    await findProfiles(type, validTargets.filter((target) => !resolved.has(target) && normalizeFeedProfileType(target.type) !== type));
  }

  const users = new Map<string, any>();
  const userIds = [...new Set([...resolved.values()]
    .filter(({ type, profile }) => type !== 'admin' && mongoose.Types.ObjectId.isValid(profile.user)
      && (!firstText(profile.fullName, profile.name, profile.displayName, profile.agencyName, profile.organization?.name)
        || !firstText(profile.profileImageUrl, profile.logoUrl, profile.avatarUrl)))
    .map(({ profile }) => profile.user.toString()))];

  if (db && userIds.length > 0) {
    try {
      const linkedUsers = await db.collection('users').find(
        { _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { projection: { _id: 1, fullName: 1, firstName: 1, lastName: 1, profileImageUrl: 1 } }
      ).toArray();
      for (const user of linkedUsers) users.set(user._id.toString(), user);
    } catch (error) {
      logger.error({ err: error }, '[Feed] Failed to load linked profile display data.');
    }
  }

  for (const target of targets) {
    const result = resolved.get(target);
    const type = result?.type ?? normalizeFeedProfileType(target.type);
    if (type === 'admin') {
      target.object.profile = {
        _id: target.id, id: target.id, type,
        fullName: 'FreeAgentPortal',
        profileImageUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
        isAdmin: true,
      };
      continue;
    }

    const { user: userId, ...profile } = result?.profile ?? {};
    const user = users.get(userId?.toString());
    target.object.profile = {
      ...profile,
      _id: profile._id ?? target.id,
      id: target.id,
      type,
      fullName: firstText(profile.fullName, profile.name, profile.displayName, profile.agencyName, profile.organization?.name,
        user?.fullName, [user?.firstName, user?.lastName].filter(Boolean).join(' ')) ?? 'Unknown author',
      profileImageUrl: firstText(profile.profileImageUrl, profile.logoUrl, profile.avatarUrl, user?.profileImageUrl) ?? '',
    };
    if (!result) logger.warn({ profileType: target.type, profileId: target.id }, '[Feed] Profile reference could not be resolved.');
  }
}
