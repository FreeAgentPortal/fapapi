import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicPreviewAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  // Reject mapped IPv4, local/link-local addresses and transition ranges too.
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function previewUrl(value: string, base?: string): URL {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.href.length > 4096) {
    throw new Error('Unsupported preview URL');
  }
  return url;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Preview deadline exceeded'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function resolvePreviewAddress(url: URL, signal: AbortSignal) {
  signal.throwIfAborted();
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await abortable(lookup(hostname, { all: true, verbatim: true }), signal);
  if (!addresses.length || addresses.some(({ address }) => !isPublicPreviewAddress(address))) {
    throw new Error('Non-public preview destination');
  }
  return addresses[0];
}

const MAX_HTML_BYTES = 1024 * 1024;
const REDIRECT_CODES = [301, 302, 303, 307, 308];

async function fetchPage(url: URL, signal: AbortSignal): Promise<{ html?: string; location?: string }> {
  const address = await resolvePreviewAddress(url, signal);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, {
      method: 'GET',
      agent: false,
      signal,
      // Pin the validated IP while retaining the URL hostname for TLS and Host.
      lookup: (_hostname, options, callback) => {
        callback(null, options.all ? [address] : address.address, address.family);
      },
      headers: {
        'User-Agent': 'FreeAgentPortal-LinkPreview/1.0',
        Accept: 'text/html, application/xhtml+xml',
        'Accept-Encoding': 'identity',
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (REDIRECT_CODES.includes(status) && response.headers.location) {
        resolve({ location: response.headers.location });
        response.destroy();
        return;
      }
      if (status < 200 || status >= 300 || !/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers['content-type'] ?? '') ||
          (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
        reject(new Error('Unsupported preview response'));
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('Incomplete preview response')));
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) {
          reject(new Error('Preview page is too large'));
          response.destroy();
          return;
        }
        chunks.push(chunk);
        const html = Buffer.concat(chunks).toString('utf8');
        if (/<\/head\s*>/i.test(html)) {
          resolve({ html });
          response.destroy();
        }
      });
      response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

export async function fetchPreviewHtml(value: string, signal: AbortSignal): Promise<{ html: string; url: string }> {
  let url = previewUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const page = await fetchPage(url, signal);
    if (page.html !== undefined) return { html: page.html, url: url.href };
    if (!page.location) break;
    // Every hop is parsed, resolved, validated and pinned independently.
    url = previewUrl(page.location, url.href);
  }
  throw new Error('Too many preview redirects');
}
