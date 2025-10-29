// util/extractPostMetadata.ts

import { ActorId } from '../model/Post.model';

/**
 * Extract hashtags from post body text
 * Examples: "#QB", "#Combine2024", "#D1Football"
 * Returns normalized lowercase array without # prefix
 */
export function extractHashtags(text?: string): string[] {
  if (!text) return [];

  // Match hashtags: # followed by alphanumeric/underscore, at least 1 char
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.matchAll(hashtagRegex);

  const hashtags = new Set<string>();
  for (const match of matches) {
    // Normalize to lowercase and store without #
    hashtags.add(match[1].toLowerCase());
  }

  return Array.from(hashtags);
}

/**
 * Extract mentions from post body text
 * Examples: "@user:123abc", "@team:456def"
 * Returns array of ActorId strings
 */
export function extractMentions(text?: string): ActorId[] {
  if (!text) return [];

  // Match @user:id or @team:id patterns
  const mentionRegex = /@(user|team):([a-zA-Z0-9]+)/g;
  const matches = text.matchAll(mentionRegex);

  const mentions = new Set<ActorId>();
  for (const match of matches) {
    const actorId = `${match[1]}:${match[2]}` as ActorId;
    mentions.add(actorId);
  }

  return Array.from(mentions);
}

/**
 * Extract URLs from post body text
 * Returns array of URL strings
 */
export function extractLinks(text?: string): string[] {
  if (!text) return [];

  // Basic URL regex - matches http/https URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = text.match(urlRegex);

  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Sanitize post body text
 * - Trim whitespace
 * - Limit length
 * - Remove potentially harmful content
 */
export function sanitizeBody(text?: string, maxLength: number = 5000): string | undefined {
  if (!text) return undefined;

  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Truncate if too long
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
}

/**
 * Process post data on creation
 * - Extract hashtags from body
 * - Extract mentions from body
 * - Sanitize body text
 * - Merge with explicitly provided hashtags/mentions
 */
export function processPostData(data: { body?: string; hashtags?: string[]; mentions?: ActorId[]; [key: string]: any }): {
  body?: string;
  hashtags?: string[];
  mentions?: ActorId[];
  [key: string]: any;
} {
  const processed = { ...data };

  // Sanitize body
  processed.body = sanitizeBody(data.body);

  if (processed.body) {
    // Extract hashtags from body
    const extractedHashtags = extractHashtags(processed.body);

    // Merge with explicitly provided hashtags (if any)
    const allHashtags = new Set([...extractedHashtags, ...(data.hashtags || []).map((h) => h.toLowerCase())]);

    processed.hashtags = allHashtags.size > 0 ? Array.from(allHashtags) : undefined;

    // Extract mentions from body
    const extractedMentions = extractMentions(processed.body);

    // Merge with explicitly provided mentions (if any)
    const allMentions = new Set([...extractedMentions, ...(data.mentions || [])]);

    processed.mentions = allMentions.size > 0 ? Array.from(allMentions) : undefined;
  } else {
    // No body, just use provided hashtags/mentions
    processed.hashtags = data.hashtags?.length ? data.hashtags.map((h) => h.toLowerCase()) : undefined;
    processed.mentions = data.mentions?.length ? data.mentions : undefined;
  }

  return processed;
}
