import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmoteCache } from '../../src/main/emoteCache';
import { EmoteSync } from '../../src/main/emoteSync';
import { validateMessage } from '../../src/shared/roomProtocol';

// A real, decodable WebP, also used to verify the content-addressed cache.
const image = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const ref = `c:${createHash('sha256').update(image).digest('hex').slice(0, 32)}`;
const base = { peer: '1111111111111111', seq: 1, ts: 1000 };
const to = '2222222222222222';
const dirs: string[] = [];
async function directory() { const d = await mkdtemp(join(tmpdir(), 'lolping-sync-')); dirs.push(d); return d; }
afterEach(async () => { vi.useRealTimers(); await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))); });

describe('image message validation', () => {
  it('accepts addressed requests and bounded chunks, stripping extra fields', () => {
    expect(validateMessage({ ...base, t: 'emoteRequest', to, e: ref, i: 0, extra: true }))
      .toEqual({ ...base, t: 'emoteRequest', to, e: ref, i: 0 });
    expect(validateMessage({ ...base, t: 'emoteChunk', to, e: ref, i: 0, total: image.length, data: image.toString('base64') }))?.toMatchObject({ t: 'emoteChunk' });
  });
  it('rejects paths, bundled refs, invalid base64, oversized and inconsistent chunks', () => {
    const chunk = { ...base, t: 'emoteChunk', to, e: ref, i: 0, total: image.length, data: image.toString('base64') };
    for (const patch of [{ e: '../secrets' }, { e: 'okay' }, { to: 'anyone' }, { i: -1 }, { i: 100 },
      { total: 12289 }, { total: 0 }, { data: '!' }, { data: 'A'.repeat(804) }, { total: 41 }]) {
      expect(validateMessage({ ...chunk, ...patch })).toBeNull();
    }
  });
});

describe('received image cache', () => {
  it('persists a verified still across restarts and rejects a mismatched hash', async () => {
    const dir = await directory();
    const cache = new EmoteCache(dir, 2);
    expect(await cache.put(ref, image)).toBe(true);
    expect(cache.has(ref)).toBe(true);
    const restarted = new EmoteCache(dir, 2);
    await restarted.load();
    expect(restarted.has(ref)).toBe(true);
    expect(await readFile(join(dir, `${ref.slice(2)}.webp`))).toEqual(image);
    expect(await cache.put(`c:${'0'.repeat(32)}`, image)).toBe(false);
    expect(await cache.put('../escape', image)).toBe(false);
  });
  it('discards corrupt files on startup and refuses non-image data', async () => {
    const dir = await directory();
    await writeFile(join(dir, `${ref.slice(2)}.webp`), 'bad');
    const cache = new EmoteCache(dir);
    await cache.load();
    expect(cache.has(ref)).toBe(false);
    expect(await cache.put(ref, Buffer.from('bad'))).toBe(false);
  });
  it('keeps the cache bounded and rejects images whose declared dimensions exceed the limit', async () => {
    const cache = new EmoteCache(await directory(), 1);
    expect(await cache.put(ref, image)).toBe(true);
    const other = Buffer.from(image); other[other.length - 1] ^= 1;
    const otherRef = `c:${createHash('sha256').update(other).digest('hex').slice(0, 32)}`;
    expect(await cache.put(otherRef, other)).toBe(true);
    expect(cache.has(ref)).toBe(false); expect(cache.has(otherRef)).toBe(true);
    const huge = Buffer.from(image); huge.writeUInt16LE(8192, 26);
    const hugeRef = `c:${createHash('sha256').update(huge).digest('hex').slice(0, 32)}`;
    expect(await cache.put(hugeRef, huge)).toBe(false);
  });
});

describe('automatic image synchronization', () => {
  it('requests a missing image, retries a lost response, validates and caches it, then reuses it', async () => {
    const cache = new EmoteCache(await directory());
    vi.useFakeTimers();
    const send = vi.fn(() => true);
    const sync = new EmoteSync({ cache, readLocal: async () => null, send });
    const ready = vi.fn(); sync.on('ready', ready);
    sync.want(base.peer, ref);
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledWith(base.peer, { t: 'emoteRequest', e: ref, i: 0 });
    await vi.advanceTimersByTimeAsync(2500);
    expect(send.mock.calls.length).toBeGreaterThan(1);
    await sync.receive({ ...base, t: 'emoteChunk', to, e: ref, i: 0, total: image.length, data: image.toString('base64') });
    expect(ready).toHaveBeenCalledWith(base.peer, ref);
    expect(cache.has(ref)).toBe(true);
    send.mockClear(); sync.want(base.peer, ref);
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).not.toHaveBeenCalled();
    sync.reset();
  });
  it('only serves images recently sent by this client, and clears transfers on room changes', async () => {
    const cache = new EmoteCache(await directory());
    vi.useFakeTimers();
    const send = vi.fn(() => true);
    const readLocal = vi.fn(async () => image);
    const sync = new EmoteSync({ cache, readLocal, send });
    const request = { ...base, t: 'emoteRequest' as const, to, e: ref, i: 0 };
    await sync.receive(request);
    expect(readLocal).not.toHaveBeenCalled();
    sync.offer(ref);
    await sync.receive(request);
    expect(send).toHaveBeenCalledWith(base.peer, { t: 'emoteChunk', e: ref, i: 0, total: image.length, data: image.toString('base64') });
    send.mockClear(); sync.reset();
    await sync.receive(request);
    expect(send).not.toHaveBeenCalled();
  });
  it('ignores unsolicited and wrong-peer chunks and never caches a tampered payload', async () => {
    const cache = new EmoteCache(await directory());
    vi.useFakeTimers();
    const sync = new EmoteSync({ cache, readLocal: async () => null, send: () => true });
    const chunk = { ...base, t: 'emoteChunk' as const, to, e: ref, i: 0, total: image.length, data: image.toString('base64') };
    await sync.receive(chunk); expect(cache.has(ref)).toBe(false);
    sync.want(base.peer, ref);
    await vi.advanceTimersByTimeAsync(500);
    await sync.receive({ ...chunk, peer: '3333333333333333' }); expect(cache.has(ref)).toBe(false);
    await sync.receive({ ...chunk, data: Buffer.alloc(image.length).toString('base64') }); expect(cache.has(ref)).toBe(false);
    sync.reset();
  });
  it('cancels an in-flight disk read on room change and stops retrying when a sender never answers', async () => {
    const cache = new EmoteCache(await directory());
    vi.useFakeTimers();
    let finish!: (b: Buffer) => void;
    const send = vi.fn(() => true);
    const sync = new EmoteSync({ cache, readLocal: () => new Promise((resolve) => { finish = resolve; }), send });
    sync.offer(ref);
    const serving = sync.receive({ ...base, t: 'emoteRequest', to, e: ref, i: 0 });
    sync.reset(); finish(image); await serving;
    expect(send).not.toHaveBeenCalled();
    sync.want(base.peer, ref);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(send).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(send).toHaveBeenCalledTimes(4);
    sync.reset();
  });
});
