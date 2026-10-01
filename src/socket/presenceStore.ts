import { randomUUID } from 'crypto';
import PresenceLease from './models/PresenceLease';
import { ActiveProfile, PresenceSnapshot, profileKey } from './types';

export const PRESENCE_REFRESH_MS = 2000;
export const PRESENCE_LEASE_MS = 15000;

export class PresenceStore {
  private readonly instanceId = randomUUID();
  private generatedAt = 0;
  private hasLease = false;

  async synchronize(profiles: ActiveProfile[]): Promise<void> {
    if (!profiles.length) {
      if (!this.hasLease) return;
      await PresenceLease.deleteOne({ _id: this.instanceId }).maxTimeMS(4000);
      this.hasLease = false;
      return;
    }
    this.hasLease = true;
    await PresenceLease.updateOne({ _id: this.instanceId }, {
      $set: { expiresAt: new Date(Date.now() + PRESENCE_LEASE_MS), profiles },
    }, { upsert: true, runValidators: true }).maxTimeMS(4000);
  }

  async snapshot(): Promise<PresenceSnapshot> {
    const leases = await PresenceLease.find({ expiresAt: { $gt: new Date() } }).select('profiles')
      .sort({ expiresAt: 1 }).maxTimeMS(4000).lean();
    const profiles = new Map<string, ActiveProfile>();
    for (const lease of leases) {
      for (const profile of lease.profiles) {
        const key = profileKey(profile);
        // Copy just the public contract, including when reading records from other workers.
        profiles.set(key, {
          profileId: profile.profileId,
          profileType: profile.profileType,
          ...(profile.displayName ? { displayName: profile.displayName } : {}),
        });
      }
    }
    this.generatedAt = Math.max(Date.now(), this.generatedAt + 1);
    return {
      generatedAt: new Date(this.generatedAt).toISOString(),
      profiles: [...profiles.values()].sort((a, b) => profileKey(a).localeCompare(profileKey(b))),
    };
  }
}
