import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmoteCache } from '../../src/main/emoteCache';
import { resolveEmoteArt } from '../../src/main/emoteLibrary';
import { EmoteSync } from '../../src/main/emoteSync';
import { open, type RoomKeys } from '../../src/main/roomCrypto';
import { RoomManager, type RemoteEmote } from '../../src/main/roomManager';
import { makeRoomCode } from '../../src/shared/roomCode';
import { decodeMessage, type EmoteAssetMsg } from '../../src/shared/roomProtocol';
import { FakeTransport } from './fixtures/fakeTransport';

const keys: RoomKeys = { msgKey: Buffer.alloc(32, 1), relayTopic: 'room' };
const dirs: string[] = [];
const rooms: RoomManager[] = [];
const syncs: EmoteSync[] = [];
afterEach(async () => {
  rooms.splice(0).forEach((r) => r.quit()); syncs.splice(0).forEach((s) => s.reset());
  vi.useRealTimers(); await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe.each(['lan', 'internet'] as const)('two clients over encrypted %s transport', (kind) => {
  it('automatically fetches a multi-block still despite packet loss and reuses the persistent cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lolping-pair-')); dirs.push(dir);
    const bytes = await readFile(join(__dirname, 'fixtures/sync.webp'));
    expect(bytes.length).toBeGreaterThan(1200);
    const ref = `c:${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}`;
    vi.useFakeTimers({ now: 1_780_000_000_000 });
    const transports = [new FakeTransport(kind), new FakeTransport(kind)];
    let dropped = false;
    transports.forEach((t, index) => {
      const deliver = (packet: Uint8Array) => {
        t.sent.push({ to: '*', packet });
        const m = decodeMessage(open(keys.msgKey, packet)!);
        if (!dropped && m?.t === 'emoteChunk' && m.i === 2) { dropped = true; return; }
        transports[1 - index].deliver(`${kind}:${index}`, packet);
      };
      t.sendTo = (_peer, packet) => deliver(packet); t.broadcast = deliver;
    });
    const pair = transports.map((t, index) => new RoomManager({
      transports: [t], now: Date.now, randomBytes: (n) => new Uint8Array(n).fill(index + 1),
      deriveKeys: async () => keys, appVersion: '0.5.1-emotesync.1', profile: () => ({ name: 'Test', color: 1, limit: 5 }),
      resolveTarget: () => ({ displayId: 1, width: 1920, height: 1080 }),
    }));
    rooms.push(...pair);
    const caches = [new EmoteCache(join(dir, 'a')), new EmoteCache(join(dir, 'b'))];
    await Promise.all(caches.map((c) => c.load()));
    const work: Promise<void>[] = [];
    const services = pair.map((r, i) => new EmoteSync({ cache: caches[i], readLocal: async () => i === 0 ? bytes : null,
      send: (peer, body) => r.sendEmoteAsset(peer, body) }));
    syncs.push(...services);
    pair.forEach((r, i) => {
      r.on('emoteAsset', (m: EmoteAssetMsg) => work.push(services[i].receive(m)));
      r.on('sessionReset', () => services[i].reset());
    });
    const ready = vi.fn(); services[1].on('ready', ready);
    pair[1].on('remoteEmote', (p: RemoteEmote) => services[1].want(p.peer, p.ref));
    const code = makeRoomCode(new Uint8Array(9).fill(1));
    await pair[0].join(code); await pair[1].join(code);
    await vi.advanceTimersByTimeAsync(3000);
    expect(pair[1].supportsEmoteSync(pair[0].self)).toBe(true);
    services[0].offer(ref); pair[0].sendEmote(ref, { d: 1, x: .5, y: .5 });
    for (let i = 0; i < 90 && !ready.mock.calls.length; i++) {
      await vi.advanceTimersByTimeAsync(400);
      while (work.length) await Promise.all(work.splice(0));
    }
    expect(dropped).toBe(true);
    expect(ready).toHaveBeenCalledWith(pair[0].self, ref);
    expect(caches[1].has(ref)).toBe(true);
    expect(await readFile(join(caches[1].dir, `${ref.slice(2)}.webp`))).toEqual(bytes);
    expect(resolveEmoteArt(ref, [], true, caches[1].has(ref))).toMatchObject({ kind: 'custom', animated: false });
    const restarted = new EmoteCache(caches[1].dir); await restarted.load(); expect(restarted.has(ref)).toBe(true);
    const imageTraffic = () => transports.flatMap((t) => t.sent).filter((s) => decodeMessage(open(keys.msgKey, s.packet)!)?.t.startsWith('emote') &&
      decodeMessage(open(keys.msgKey, s.packet)!)?.t !== 'emote').length;
    const before = imageTraffic();
    pair[0].sendEmote(ref, { d: 1, x: .5, y: .5 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(imageTraffic()).toBe(before);
    expect(transports.flatMap((t) => t.sent).every((s) => s.packet.length <= 1200)).toBe(true);
  });
});
