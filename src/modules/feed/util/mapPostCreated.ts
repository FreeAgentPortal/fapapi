// services/activityMappers.ts

import { PublishActivityInput } from './ActivityClient';

// Minimal shape we need from Post — aligns with models/Post.model.ts
type MinimalPost = {
  _id: string;
  authorId: `user:${string}` | `team:${string}`;
  body?: string;
  sport?: string;
  hashtags?: string[]; // already normalized like ["QB","combine"]
  mentions?: (`user:${string}` | `team:${string}`)[]; // not used in Activity yet
  media?: Array<{
    kind: 'image' | 'video';
    url: string;
    thumbUrl?: string;
    processing?: 'pending' | 'ready' | 'failed';
  }>;
  links?: Array<{
    url: string;
    canonicalUrl?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
  }>;
  visibility: 'public' | 'followers' | 'private';
  isDeleted: boolean;
  moderation?: { status: 'clean' | 'flagged' | 'removed' };
  createdAt?: Date;
};

/** Utility: strip markdown-lite and collapse whitespace for a compact summary */
const toSummary = (text?: string, max = 160): string | undefined => {
  if (!text) return undefined;
  const plain = text
    .replace(/```[\s\S]*?```/g, '') // remove code blocks
    .replace(/`[^`]*`/g, '') // inline code
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
    .replace(/[#*_>~`]/g, '') // basic markdown tokens
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max - 1) + '…' : plain || undefined;
};

/** Utility: best available thumbnail (media thumb, image url, or link preview image) */
const pickThumb = (p: MinimalPost): string | undefined => {
  // Prefer first READY media thumb, then image url
  const firstReady = (p.media ?? []).find((m) => m.processing !== 'failed');
  if (firstReady?.thumbUrl) return firstReady.thumbUrl;
  if (firstReady?.kind === 'image' && firstReady.url) return firstReady.url;

  // Fallback: first link preview image
  const lp = (p.links ?? []).find((l) => !!l.imageUrl);
  return lp?.imageUrl ?? undefined;
};

/** Utility: map post hashtags into Activity tags, prefix sport if present */
const toTags = (sport?: string, hashtags?: string[]): string[] | undefined => {
  const hs = (hashtags ?? []).map((h) => (h.startsWith('#') ? h.slice(1) : h)).filter(Boolean);
  const tags = [...(sport ? [sport] : []), ...hs];
  return tags.length ? tags : undefined;
};

/**
 * Map a Post -> PublishActivityInput for the activity feed.
 * Skips if post is not visible publicly, deleted, or moderation-removed.
 */
export const mapPostCreated = (p: MinimalPost): PublishActivityInput | null => {
  // Gate: only publish socially visible items to the public activity stream
  if (p.visibility !== 'public') return null;
  if (p.isDeleted) return null;
  if (p.moderation?.status === 'removed') return null;

  const summary = toSummary(p.body, 160);
  const thumbUrl = pickThumb(p);
  const tags = toTags(p.sport, p.hashtags);

  return {
    verb: 'post.created',
    actorId: p.authorId, // "user:…" | "team:…"
    object: { collection: 'posts', id: String(p._id) },
    visibility: 'public',
    sport: p.sport,
    tags,
    summary,
    thumbUrl,
    // Idempotency ensures one feed card per post
    idempotencyKey: `post.created:posts:${p._id}`,
    createdAt: p.createdAt, // let Mongo default if undefined
  };
};
