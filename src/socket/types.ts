import { Server, Socket } from 'socket.io';

export const PROFILE_TYPES = ['athlete', 'agent', 'professional', 'team', 'scout', 'admin'] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export interface ProfileIdentity {
  profileId: string;
  profileType: ProfileType;
}

export interface ActiveProfile extends ProfileIdentity {
  displayName?: string;
}

export interface PresenceSnapshot {
  generatedAt: string;
  profiles: ActiveProfile[];
}

export interface SocketAccount {
  userId: string;
  expiresAt: number;
}

export interface ProfileSocketData {
  account: SocketAccount;
  profile?: ProfileIdentity;
  setupRevision: number;
  presenceRevision: number;
  presenceSubscription?: number;
}

export type ProfileSocket = Socket<any, any, any, ProfileSocketData>;
export type ProfileServer = Server<any, any, any, ProfileSocketData>;

// Client-controlled messaging room events must never grant a reporting subscription.
export const PRESENCE_ROOM = '__profile_presence_subscribers__';
export const profileKey = (profile: ProfileIdentity) => `${profile.profileType}:${profile.profileId}`;
