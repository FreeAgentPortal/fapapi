export default class AthleteService {
  // Add your service methods here
  // For example, you can add methods for user registration, login, etc.
  static async createProfile(userId: string): Promise<any> {
    // Implement your profile creation logic here
    return new Promise((resolve) => {
      resolve({ _id: userId });
    });
  }
}
