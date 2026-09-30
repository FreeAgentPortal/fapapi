import { Model } from 'mongoose';
import User from '../modules/auth/model/User';
import { AthleteModel } from '../modules/profiles/athlete/models/AthleteModel';
import { AgentProfileModel } from '../modules/profiles/agent/model/AgentProfile';
import { ProfessionalProfileModel } from '../modules/profiles/professional/model/ProfessionalProfile';
import TeamModel from '../modules/profiles/team/model/TeamModel';
import { ScoutModel } from '../modules/profiles/scout/model/ScoutProfile';
import AdminModel from '../modules/profiles/admin/model/AdminModel';
import { ActiveProfile, PROFILE_TYPES, ProfileIdentity, ProfileSocket, ProfileType, profileKey } from './types';

const profileModels: Record<ProfileType, Model<any>> = {
  athlete: AthleteModel,
  agent: AgentProfileModel,
  professional: ProfessionalProfileModel,
  team: TeamModel,
  scout: ScoutModel,
  admin: AdminModel,
};

export class SocketAccessError extends Error {}

export interface AuthorizedProfile {
  profile: ActiveProfile;
  canReportPresence: boolean;
}

export function parseProfileIdentity(payload: unknown): ProfileIdentity {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SocketAccessError('Invalid profile setup.');
  }
  const data = payload as Record<string, unknown>;
  // Legacy auth-object setup is deliberately rejected, never interpreted as a profile.
  if (Object.keys(data).some((key) => key !== 'profileId' && key !== 'profileType') ||
      typeof data.profileId !== 'string' || !/^[a-f\d]{24}$/.test(data.profileId) ||
      !PROFILE_TYPES.includes(data.profileType as ProfileType)) {
    throw new SocketAccessError('Invalid profile setup.');
  }
  return { profileId: data.profileId, profileType: data.profileType as ProfileType };
}

function authorizeProfile(account: any, document: any, identity: ProfileIdentity): AuthorizedProfile | undefined {
  if (!account?.isActive || !document || document.isActive === false ||
      String(account.profileRefs?.[identity.profileType]) !== identity.profileId) return;

  const userId = String(account._id);
  const hasAccess = identity.profileType === 'team'
    ? document.linkedUsers?.some((member: any) => String(member.user) === userId && ['admin', 'member'].includes(member.role))
    : String(identity.profileType === 'athlete' ? document.userId : document.user) === userId;
  if (!hasAccess) return;

  const name = identity.profileType === 'athlete' ? document.fullName
    : identity.profileType === 'team' ? document.name : document.displayName;
  return {
    profile: { ...identity, ...(typeof name === 'string' && name.trim() ? { displayName: name.trim() } : {}) },
    canReportPresence: identity.profileType === 'admin' &&
      document.roles?.some((role: string) => role === 'admin' || role === 'developer') === true,
  };
}

export async function resolveSocketProfile(socket: ProfileSocket, identity: ProfileIdentity): Promise<AuthorizedProfile> {
  if (!socket.data.account || socket.data.account.expiresAt <= Date.now()) {
    throw new SocketAccessError('Session expired.');
  }
  const [account, document] = await Promise.all([
    User.findById(socket.data.account.userId).select('_id isActive profileRefs').lean(),
    profileModels[identity.profileType].findById(identity.profileId)
      .select('_id user userId linkedUsers isActive roles displayName fullName name').lean(),
  ]);
  const authorized = authorizeProfile(account, document, identity);
  if (!authorized || socket.data.account.expiresAt <= Date.now()) throw new SocketAccessError('Profile access denied.');
  return authorized;
}

// Batch revalidation keeps deactivation, access revocation and name changes current
// without issuing separate account/profile queries for every browser tab.
export async function resolveRegisteredProfiles(sockets: ProfileSocket[]): Promise<Map<string, AuthorizedProfile>> {
  const registered = sockets.filter((socket) => socket.connected && socket.data.profile && socket.data.account.expiresAt > Date.now())
    .map((socket) => ({ socket, identity: socket.data.profile!, account: socket.data.account }));
  const authorized = new Map<string, AuthorizedProfile>();
  if (!registered.length) return authorized;

  const accounts = await User.find({ _id: { $in: [...new Set(registered.map(({ account }) => account.userId))] } })
    .select('_id isActive profileRefs').lean();
  const accountMap = new Map(accounts.map((account) => [String(account._id), account]));
  const documents = new Map<string, any>();
  await Promise.all(PROFILE_TYPES.map(async (profileType) => {
    const ids = [...new Set(registered.filter(({ identity }) => identity.profileType === profileType)
      .map(({ identity }) => identity.profileId))];
    if (!ids.length) return;
    const profiles = await profileModels[profileType].find({ _id: { $in: ids } })
      .select('_id user userId linkedUsers isActive roles displayName fullName name').lean();
    for (const profile of profiles) documents.set(`${profileType}:${profile._id}`, profile);
  }));
  for (const { socket, identity, account } of registered) {
    const result = authorizeProfile(accountMap.get(account.userId), documents.get(profileKey(identity)), identity);
    if (result) authorized.set(socket.id, result);
  }
  return authorized;
}
