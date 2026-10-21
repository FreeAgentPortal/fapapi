import type { LinkPreview } from '../model/Post.model';
import { extractLinks } from './extractPostMetadata';
import { fetchPreviewHtml, previewUrl, resolvePreviewAddress } from './previewHttp';

function decodeText(value: string, limit: number): string | undefined {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', copy: '©', reg: '®' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  }).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) || undefined;
}

/** Parse only metadata; never execute scripts or return page HTML to clients. */
export function parsePreviewMetadata(html: string): Omit<LinkPreview, 'url'> {
  const head = html.split(/<\/head\s*>/i)[0]
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const metadata = new Map<string, string>();
  for (const tag of head.match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(/\s([a-z_:][a-z\d_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
    }
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const value = attrs.get('content');
    if (key && value && !metadata.has(key)) metadata.set(key, value);
  }
  const pick = (keys: string[], limit: number) => keys.map((key) => decodeText(metadata.get(key) ?? '', limit)).find(Boolean);
  return {
    title: pick(['og:title', 'twitter:title'], 300) ?? decodeText(head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '', 300),
    description: pick(['og:description', 'twitter:description', 'description'], 1000),
    siteName: pick(['og:site_name'], 150),
    imageUrl: pick(['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'], 4096),
  };
}

/** Best-effort enrichment in the create request, with one deadline and no retries. */
export async function fetchPostLinkPreview(body: unknown, media: unknown): Promise<LinkPreview[]> {
  if (typeof body !== 'string' || (Array.isArray(media) && media.length > 0)) return [];
  const url = extractLinks(body)[0];
  if (!url) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  timeout.unref();
  try {
    const page = await fetchPreviewHtml(url, controller.signal);
    const { imageUrl, ...metadata } = parsePreviewMetadata(page.html);
    const preview: LinkPreview = { url, canonicalUrl: page.url, ...metadata };
    if (imageUrl) {
      try {
        const image = previewUrl(imageUrl, page.url);
        await resolvePreviewAddress(image, controller.signal);
        preview.imageUrl = image.href;
      } catch {
        // Keep text metadata when the thumbnail URL is invalid or times out.
      }
    }
    return [preview];
  } catch {
    // A blocked, unavailable or slow website must not prevent publishing a post.
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
