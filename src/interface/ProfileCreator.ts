// interfaces/ProfileCreator.ts
export interface ProfileCreator {
  createProfile(userId: string, profileData: any): Promise<{ profileId: string }>;
}
