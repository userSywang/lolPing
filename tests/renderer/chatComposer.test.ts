import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_CHAT, normalizeChat } from '../../src/shared/chat';

class Control {
  value = ''; disabled = false; textContent = ''; title = ''; placeholder = '';
  style = { setProperty: vi.fn(), color: '' };
  attributes = new Map<string, string>();
  listeners = new Map<string, () => void>();
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(key: string, fn: () => void) { this.listeners.set(key, fn); }
  focus() {}
  click() { if (!this.disabled) this.listeners.get('click')?.(); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

it('keeps a new channel selection when an older focus refresh arrives and locks the channel during send', async () => {
  const controls = new Map(['message','input-bubble','count','random','announcement','status','send','close'].map((id) => [id, new Control()]));
  const events = new Map<string, () => void>();
  const initial = { preferences: normalizeChat(DEFAULT_CHAT), members: 1, active: true };
  let refresh!: (state: typeof initial) => void, complete!: (result: { ok: true }) => void;
  const api = {
    get: vi.fn().mockResolvedValueOnce(initial).mockImplementationOnce(() => new Promise((resolve) => { refresh = resolve; })),
    preferences: vi.fn().mockResolvedValue(initial.preferences),
    send: vi.fn(() => new Promise((resolve) => { complete = resolve; })), close: vi.fn(),
  };
  vi.stubGlobal('document', { getElementById: (id: string) => controls.get(id), addEventListener: vi.fn() });
  vi.stubGlobal('window', { chatApi: api, addEventListener: (key: string, fn: () => void) => events.set(key, fn) });
  await import('../../src/renderer/chat/main'); await flush();
  events.get('focus')!();
  controls.get('announcement')!.click(); await flush();
  refresh(initial); await flush();
  expect(controls.get('announcement')!.attributes.get('aria-pressed')).toBe('true');
  controls.get('message')!.value = '这是一条公告';
  controls.get('send')!.click();
  expect(controls.get('random')!.disabled).toBe(true);
  controls.get('random')!.click(); await flush();
  expect(api.send).toHaveBeenCalledWith('这是一条公告', 'announcement');
  complete({ ok: true }); await flush();
  expect(api.close).toHaveBeenCalledOnce();
  expect(controls.get('message')!.value).toBe('');
});
