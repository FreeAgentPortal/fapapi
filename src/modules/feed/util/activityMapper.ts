// services/activityMappers.ts

import { PublishActivityInput } from './ActivityClient';
import { Visibility as EventVisibility } from '../model/Event.model';

/**
 * Maps Event visibility to Activity visibility
 * Event: 'public' | 'team' | 'invite-only' | 'private'
 * Activity: 'public' | 'private' | 'friends-only' | 'athletes-only' | 'team-only'
 */
const mapEventVisibilityToActivity = (eventVisibility?: string): 'public' | 'private' | 'friends-only' | 'athletes-only' | 'team-only' => {
  switch (eventVisibility) {
    case 'public':
      return 'public';
    case 'team':
      return 'team-only';
    case 'invite-only':
      return 'athletes-only'; // invite-only maps to athletes-only as closest match
    case 'private':
      return 'private';
    default:
      return 'public';
  }
};

export const mapEventCreated = (params: {
  eventId: string;
  teamId: string;
  sport?: string;
  title?: string;
  visibility?: string;
  kind?: string; // "Open Practice" | "Tryout" | ...
  startsAt?: Date;
  location?: string;
  thumbUrl?: string;
}): PublishActivityInput => {
  const summaryParts = [
    params.title ?? 'New Event',
    params.kind ? `• ${params.kind}` : '',
    params.startsAt ? `• ${new Intl.DateTimeFormat().format(params.startsAt)}` : '',
    params.location ? `• ${params.location}` : '',
  ].filter(Boolean);

  return {
    verb: 'event.created',
    actorId: `team:${params.teamId}`,
    object: { collection: 'events', id: params.eventId },
    sport: params.sport,
    visibility: mapEventVisibilityToActivity(params.visibility),
    tags: [params.sport, params.kind].filter(Boolean) as string[],
    summary: summaryParts.join(' '),
    thumbUrl: params.thumbUrl,
    // Optional dedupe if you expect retries:
    idempotencyKey: `event.created:events:${params.eventId}`,
  };
};

export const mapPostCreated = (params: { postId: string; userId: string; sport?: string; caption?: string; mediaThumbUrl?: string; tags?: string[] }): PublishActivityInput => ({
  verb: 'post.created',
  actorId: `user:${params.userId}`,
  object: { collection: 'posts', id: params.postId },
  sport: params.sport,
  tags: [params.sport, ...(params.tags ?? [])].filter(Boolean) as string[],
  summary: params.caption,
  thumbUrl: params.mediaThumbUrl,
  // idempotencyKey: `post.created:posts:${params.postId}`,
});
