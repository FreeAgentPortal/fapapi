// interfaces/ProfileCreator.ts
export interface ProfileCreator {
  createProfile(userId: string): Promise<{ profileId: string }>;
}
