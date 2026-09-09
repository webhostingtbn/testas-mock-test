import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { ImageService, refreshSignedUrl } from '../image-service';

const originalFetch = globalThis.fetch;
const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

let fetchCalls = 0;
let nextResponse: { signedUrl?: string; expiresIn?: unknown } = {};

function stubFetch(): void {
  fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls++;
    return {
      ok: true,
      json: async () => ({ ...nextResponse }),
    };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = '';
  nextResponse = { signedUrl: 'https://signed.example/1', expiresIn: 5 * 60 * 60 };
  stubFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
});

describe('ImageService.resolveImageUrl caching', () => {
  it('serves repeat paths from cache within the server TTL', async () => {
    // NOTE: service caches are module-shared, so every test uses its own path.
    const service = new ImageService();
    const first = await service.resolveImageUrl('cache-hit.png');
    const second = await service.resolveImageUrl('cache-hit.png');
    assert.strictEqual(first, 'https://signed.example/1');
    assert.strictEqual(second, 'https://signed.example/1');
    assert.strictEqual(fetchCalls, 1);
  });

  it('never caches responses without a usable expiry', async () => {
    nextResponse = { signedUrl: 'https://signed.example/1' };
    const service = new ImageService();
    await service.resolveImageUrl('no-cache.png');
    await service.resolveImageUrl('no-cache.png');
    assert.strictEqual(fetchCalls, 2);
  });

  it('dedupes concurrent signs for the same path', async () => {
    const service = new ImageService();
    const [first, second] = await Promise.all([
      service.resolveImageUrl('dedupe.png'),
      service.resolveImageUrl('dedupe.png'),
    ]);
    assert.strictEqual(first, 'https://signed.example/1');
    assert.strictEqual(second, 'https://signed.example/1');
    assert.strictEqual(fetchCalls, 1);
  });

  it('re-signs after the cached entry expires', async () => {
    // expiresIn 121s minus the 120s safety margin => ~1s cache lifetime.
    nextResponse = { signedUrl: 'https://signed.example/1', expiresIn: 121 };
    const service = new ImageService();
    await service.resolveImageUrl('expiry.png');
    assert.strictEqual(fetchCalls, 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await service.resolveImageUrl('expiry.png');
    assert.strictEqual(fetchCalls, 2);
  });
});

describe('refreshSignedUrl', () => {
  it('re-signs a known URL and serves the fresh one from cache', async () => {
    const service = new ImageService();
    const original = await service.resolveImageUrl('refresh.png');
    assert.strictEqual(fetchCalls, 1);

    nextResponse = { signedUrl: 'https://signed.example/2', expiresIn: 5 * 60 * 60 };
    const fresh = await refreshSignedUrl(original ?? '');
    assert.strictEqual(fresh, 'https://signed.example/2');
    assert.strictEqual(fetchCalls, 2);

    // The refreshed URL is cached under its path — no further signing.
    assert.strictEqual(await service.resolveImageUrl('refresh.png'), 'https://signed.example/2');
    assert.strictEqual(fetchCalls, 2);
  });

  it('returns undefined for unknown URLs without signing', async () => {
    assert.strictEqual(await refreshSignedUrl('https://signed.example/unknown'), undefined);
    assert.strictEqual(fetchCalls, 0);
  });
});
