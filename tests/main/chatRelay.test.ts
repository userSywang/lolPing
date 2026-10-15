import { randomBytes } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { deriveRoomKeys } from '../../src/main/roomCrypto';
import { RelayTransport } from '../../src/main/relayTransport';
import { RoomManager } from '../../src/main/roomManager';
import { makeRoomCode } from '../../src/shared/roomCode';
import { FakeSocket } from './fixtures/fakeSocket';

afterEach(() => vi.useRealTimers());
it('a relay sees signed ciphertext events while two clients exchange Chinese text', async () => {
  const code = makeRoomCode(randomBytes(9));
  const keys = await deriveRoomKeys(code);
  vi.useFakeTimers({ now: 1780000000000 });
  const sockets: FakeSocket[] = [], serverEvents: string[] = [];
  const transports = [0, 1].map(() => new RelayTransport({ urls: ['wss://test.invalid'], socket: (url) => {
    const socket = new FakeSocket(url); sockets.push(socket);
    const original = socket.send.bind(socket);
    socket.send = (data) => {
      original(data);
      const frame = JSON.parse(data);
      if (frame[0] !== 'EVENT') return;
      serverEvents.push(data);
      for (const other of sockets) if (other.readyState === 1) other.receive(['EVENT', 'lolping', frame[1]]);
      socket.receive(['OK', frame[1].id, true, '']);
    };
    return socket;
  } }));
  const rooms = transports.map((t, i) => new RoomManager({ transports: [t], now: Date.now,
    randomBytes: (n) => new Uint8Array(n).fill(i + 1), deriveKeys: async () => keys, appVersion: '0.5.3-privatechat.1',
    profile: () => ({ name: `User${i}`, color: 1, limit: 5 }), resolveTarget: () => null }));
  const receive = vi.fn(); rooms[1].on('remoteChat', receive);
  try {
    await rooms[0].join(code); sockets[0].open(); sockets[0].receive(['EOSE', 'lolping']);
    await rooms[1].join(code); sockets[1].open(); sockets[1].receive(['EOSE', 'lolping']);
    // Initial presence can wait out the shared transport's 1 s cap, then joining settles for 3 s.
    await vi.advanceTimersByTimeAsync(5000);
    expect(rooms[0].chatMembers()).toBe(1);
    expect(rooms[0].sendChat('偷偷告诉你：午饭吃鱼')).toEqual({ ok: true });
    expect(receive).toHaveBeenCalledWith(expect.objectContaining({ text: '偷偷告诉你：午饭吃鱼' }));
    expect(serverEvents.some((e) => e.includes('偷偷告诉你'))).toBe(false);
    expect(serverEvents.some((e) => e.includes(code))).toBe(false);
    for (const frame of serverEvents) {
      const event = JSON.parse(frame)[1];
      expect(Buffer.from(event.content, 'base64').includes(Buffer.from('偷偷告诉你'))).toBe(false);
      expect(event).not.toHaveProperty('msgKey');
    }
  } finally { rooms.forEach((r) => r.quit()); await vi.advanceTimersByTimeAsync(600); }
});
