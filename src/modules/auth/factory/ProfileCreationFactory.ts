// factories/ProfileCreationFactory.ts
import { ProfileCreator } from '../../../interface/ProfileCreator';
import { AdminProfileCreator } from '../../../service/profile/AdminProfileCreator';
import { AthleteProfileCreator } from '../../../service/profile/AthleteProfileCreator';
import { TeamProfileCreator } from '../../../service/profile/TeamProfileCreator';

export class ProfileCreationFactory {
  static getProfileCreator(role: string): ProfileCreator | null {
    switch (role) {
      case 'athlete':
        return new AthleteProfileCreator();
      case 'team':
        return new TeamProfileCreator();
      case 'admin':
        return new AdminProfileCreator();
      default:
        return null;
    }
  }
}
