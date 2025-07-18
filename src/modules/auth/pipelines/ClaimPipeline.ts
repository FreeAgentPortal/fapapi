import { BasePipeline } from '../../../utils/basePipeline';

export class ClaimPipeline extends BasePipeline {
  /**
   * Creates a user lookup for claims with standard fields
   */
  static getUserLookup(): any {
    return this.createUserLookup('user', 'user', ['_id', 'fullName', 'profileImageUrl', 'email']);
  }

  /**
   * Creates a detailed user lookup for single claim view
   */
  static getDetailedUserLookup(): any {
    return this.createUserLookup('user', 'user', ['_id', 'fullName', 'profileImageUrl', 'email', 'phoneNumber', 'role']);
  }

  /**
   * Creates a team profile lookup
   */
  static getTeamProfileLookup(): any {
    return this.createConditionalLookup(
      'teamprofiles',
      { profileId: '$profile', claimType: '$claimType' },
      [{ $eq: ['$_id', '$$profileId'] }, { $eq: ['$$claimType', 'team'] }],
      'teamProfile'
    );
  }

  /**
   * Creates a detailed team profile lookup
   */
  static getDetailedTeamProfileLookup(): any {
    return this.createConditionalLookup(
      'teamprofiles',
      { profileId: '$profile', claimType: '$claimType' },
      [{ $eq: ['$_id', '$$profileId'] }, { $eq: ['$$claimType', 'team'] }],
      'teamProfile',
      [
        this.createProjection({
          include: ['_id', 'teamName', 'location', 'description', 'profileImageUrl', 'contactInfo'],
        }),
      ]
    );
  }

  /**
   * Creates an athlete profile lookup
   */
  static getAthleteProfileLookup(): any {
    return this.createConditionalLookup(
      'athleteprofiles',
      { profileId: '$profile', claimType: '$claimType' },
      [{ $eq: ['$_id', '$$profileId'] }, { $eq: ['$$claimType', 'athlete'] }],
      'athleteProfile',
      [
        this.createProjection({
          include: ['_id', 'fullName', 'profileImageUrl', 'email', 'slug'],
        }),
      ]
    );
  }

  /**
   * Creates a detailed athlete profile lookup
   */
  static getDetailedAthleteProfileLookup(): any {
    return this.createConditionalLookup(
      'athleteprofiles',
      { profileId: '$profile', claimType: '$claimType' },
      [{ $eq: ['$_id', '$$profileId'] }, { $eq: ['$$claimType', 'athlete'] }],
      'athleteProfile',
      [
        this.createProjection({
          include: ['_id', 'fullName', 'profileImageUrl', 'email', 'slug', 'hometown', 'college', 'position', 'measurements', 'metrics'],
        }),
      ]
    );
  }

  /**
   * Creates the profile merge stage
   */
  static getProfileMerge(): any {
    return this.createConditionalFieldMerge('profile', { $eq: ['$claimType', 'team'] }, { $arrayElemAt: ['$teamProfile', 0] }, { $arrayElemAt: ['$athleteProfile', 0] });
  }

  /**
   * Creates cleanup stages
   */
  static getCleanupStages(): any[] {
    return [
      this.createProjection({
        exclude: ['teamProfile', 'athleteProfile'],
      }),
      this.createUnwind({
        path: '$user',
        preserveNullAndEmptyArrays: true,
      }),
    ];
  }

  /**
   * Gets the minimal pipeline for list views (performance optimized)
   */
  getMinimalEntriesPipeline(): any[] {
    return ClaimPipeline.combinePipelines(
      [ClaimPipeline.getUserLookup()],
      [ClaimPipeline.getTeamProfileLookup()],
      [ClaimPipeline.getAthleteProfileLookup()],
      [ClaimPipeline.getProfileMerge()],
      ClaimPipeline.getCleanupStages()
    );
  }

  /**
   * Gets the complete pipeline for standard views
   */
  getCompleteEntriesPipeline(): any[] {
    return this.getMinimalEntriesPipeline();
  }

  /**
   * Gets the detailed pipeline for single claim views
   */
  getDetailedEntriesPipeline(): any[] {
    return ClaimPipeline.combinePipelines(
      [ClaimPipeline.getDetailedUserLookup()],
      [ClaimPipeline.getDetailedTeamProfileLookup()],
      [ClaimPipeline.getDetailedAthleteProfileLookup()],
      [ClaimPipeline.getProfileMerge()],
      ClaimPipeline.getCleanupStages()
    );
  }

  /**
   * Creates a claim status lookup pipeline
   */
  static getClaimStatusPipeline(profileId: string): any[] {
    return [BasePipeline.createIdMatch(profileId, 'profile')];
  }
}
