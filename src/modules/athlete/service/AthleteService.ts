import { AthleteProfileHandler } from "../handlers/AtheleteProfileHandler";

export default class AthleteService {
  private profileHandler: AthleteProfileHandler;
  constructor(profileHandler: AthleteProfileHandler = new AthleteProfileHandler()) {
    this.profileHandler = profileHandler;
  }

  async createProfile(userId: string, profileData: any): Promise<any> {
    try {
      const profile = await this.profileHandler.createProfile({
        userId,
        ...profileData,
      });
      return profile;
    } catch (error: any) {
      throw new Error(`Failed to create athlete profile: ${error.message}`);
    }
  } 
}
