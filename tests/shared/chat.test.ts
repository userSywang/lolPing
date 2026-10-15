import { describe, expect, it } from 'vitest';
import { normalizeChat, chatText, DEFAULT_CHAT } from '../../src/shared/chat';
import { decodeMessage, encodeMessage, validateMessage } from '../../src/shared/roomProtocol';
import { open, seal, MAX_PACKET } from '../../src/main/roomCrypto';

const base = { peer: '1111111111111111', seq: 1, ts: 1780000000000 };
describe('private room text', () => {
  it('validates bounded Unicode text, excludes invisible controls and never accepts oversized messages', () => {
    expect(chatText('  你好\n猫猫  ')).toBe('你好\n猫猫');
    expect(chatText('猫'.repeat(101))).toBeNull();
    expect(chatText('😀'.repeat(100))).toHaveLength(200);
    expect(chatText(' \n ')).toBeNull();
    expect(chatText('hi\u202eevil')).toBe('hievil');
    expect(validateMessage({ ...base, t: 'chat', text: '你好' })).toEqual({ ...base, t: 'chat', text: '你好' });
  });
  it('keeps 100 emoji below the packet cap, hides plaintext and refuses a wrong key or altered packet', () => {
    const key = Buffer.alloc(32, 7);
    const msg = { ...base, t: 'chat' as const, text: '秘密聊天'.repeat(25) };
    const packet = seal(key, encodeMessage(msg));
    expect(packet.length).toBeLessThanOrEqual(MAX_PACKET);
    expect(packet.includes(Buffer.from(msg.text))).toBe(false);
    expect(decodeMessage(open(key, packet)!)).toEqual(msg);
    expect(open(Buffer.alloc(32, 8), packet)).toBeNull();
    const tampered = Buffer.from(packet); tampered[20] ^= 1;
    expect(open(key, tampered)).toBeNull();
    expect(seal(key, encodeMessage({ ...msg, text: '😀'.repeat(100) })).length).toBeLessThanOrEqual(MAX_PACKET);
  });
  it('normalizes local display choices independently of incoming messages', () => {
    expect(normalizeChat(null)).toEqual(DEFAULT_CHAT);
    expect(normalizeChat({ fontSize: 200, opacity: -1, x: -5, y: 8, color: 'url(evil)', position: 'unknown' }))
      .toMatchObject({ fontSize: 32, opacity: .3, x: 0, y: 1, color: DEFAULT_CHAT.color, position: 'random' });
  });
  it('keeps independent announcement preferences and encrypts announcement packets', () => {
    expect(normalizeChat({ duration: 4, announcement: { duration: 9999, fontSize: 16, position: 'random' }, mode: 'announcement' }))
      .toMatchObject({ duration: 4, mode: 'announcement', announcement: { duration: 600, fontSize: 16, position: 'fixed' } });
    expect(normalizeChat({ position: 'fixed' }).announcement.duration).toBe(60);
    const msg = { ...base, t: 'announcement' as const, text: '我的公告' };
    const packet = seal(Buffer.alloc(32, 7), encodeMessage(msg));
    expect(packet.includes(Buffer.from(msg.text))).toBe(false);
    expect(decodeMessage(open(Buffer.alloc(32, 7), packet)!)).toEqual(msg);
  });
});
