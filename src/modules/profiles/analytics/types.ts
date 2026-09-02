export type ProfileSubjectType = 'athlete' | 'professional';

export type ViewerProfileType = 'team' | 'scout' | 'agent' | 'athlete' | 'professional' | 'admin';

export type ProfileViewSessionSource = 'header' | 'jwt' | 'legacy';

export interface ProfileViewRecordedEvent {
  viewId: string;
  subjectType: ProfileSubjectType;
  subjectProfileId: string;
  subjectOwnerUserId: string;
  viewerType: ViewerProfileType;
  occurredAt: string;
}

export interface ProfileViewReport {
  generatedAt: string;
  subjectType: ProfileSubjectType;
  subjectProfileId: string;
  days: number;
  summary: {
    totalViews: number;
    uniqueViewers: number;
  };
  viewsByType: Record<ViewerProfileType, number>;
  dailyViews: Array<{
    date: string;
    totalViews: number;
    uniqueViewers: number;
  }>;
}
