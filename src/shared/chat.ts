export interface ChatPreferences {
  enabled: boolean;
  fontSize: number;
  color: string;
  opacity: number;
  duration: number;
  position: 'fixed' | 'mouse' | 'random';
  x: number;
  y: number;
}
export const DEFAULT_CHAT: ChatPreferences = { enabled: true, fontSize: 24, color: '#201b16', opacity: 1, duration: 6, position: 'fixed', x: .95, y: .9 };
const number = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
export function normalizeChat(raw: unknown): ChatPreferences {
  const r = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    fontSize: Math.round(number(r.fontSize, 24, 12, 32)),
    color: typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : DEFAULT_CHAT.color,
    opacity: number(r.opacity, 1, .3, 1), duration: number(r.duration, 6, 3, 15),
    position: r.position === 'mouse' || r.position === 'random' ? r.position : 'fixed',
    x: number(r.x, .95, 0, 1), y: number(r.y, .9, 0, 1),
  };
}
/** Preserve ordinary Chinese/emoji/newlines, but discard bidi and control characters. Reject rather than silently truncate. */
export function chatText(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 400) return null;
  const text = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim();
  return text && [...text].length <= 100 ? text : null;
}
export type ChatSendResult = { ok: true } | { ok: false; error: string };
export const CHAT_CH = { get: 'chat:get', preferences: 'chat:preferences', send: 'chat:send', preview: 'chat:preview', close: 'chat:close' } as const;
export interface ChatApi {
  get(): Promise<{ preferences: ChatPreferences; members: number; active: boolean }>;
  preferences(p: Partial<ChatPreferences>): Promise<ChatPreferences>;
  send(text: string): Promise<ChatSendResult>;
  preview(text: string): Promise<void>;
  close(): void;
}
