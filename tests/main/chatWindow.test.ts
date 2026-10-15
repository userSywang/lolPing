import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_CH, DEFAULT_CHAT } from '../../src/shared/chat';
const state = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), windows: [] as any[] }));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class Window extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
    constructor(public options: unknown) { super(); state.windows.push(this); }
    removeMenu() {} show() {} focus() {} destroy() { this.emit('closed'); }
  }
  return { BrowserWindow: Window, ipcMain: { handle: (c: string, fn: (...args: any[]) => any) => state.handlers.set(c, fn),
    on: (c: string, fn: (...args: any[]) => any) => state.handlers.set(c, fn) },
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) } };
});
vi.mock('../../src/main/paths', () => ({ loadPage: vi.fn(), preloadPath: () => 'chat.js', pageUrl: () => 'lolping://app/chat/index.html' }));
import { ChatWindow } from '../../src/main/chatWindow';
beforeEach(() => { state.handlers.clear(); state.windows.length = 0; });
describe('composer security boundary', () => {
  it('rejects a different renderer and validates text and preferences in the main process', () => {
    const send = vi.fn(() => ({ ok: true as const })), save = vi.fn();
    const chat = new ChatWindow({ preferences: () => DEFAULT_CHAT, state: () => ({ members: 1, active: true }), send, save, preview: vi.fn(), capture: vi.fn() });
    chat.open();
    const sender = state.windows[0].webContents;
    expect(state.handlers.get(CHAT_CH.send)!({ sender: {} }, '秘密')).toMatchObject({ ok: false });
    expect(send).not.toHaveBeenCalled();
    expect(state.handlers.get(CHAT_CH.send)!({ sender }, '猫'.repeat(101))).toMatchObject({ ok: false });
    expect(send).not.toHaveBeenCalled();
    state.handlers.get(CHAT_CH.send)!({ sender }, '秘密'); expect(send).toHaveBeenCalledWith('秘密');
    state.handlers.get(CHAT_CH.preferences)!({ sender }, { fontSize: 10000, opacity: 0, color: 'javascript:evil' });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 32, opacity: .3, color: DEFAULT_CHAT.color }));
    expect(state.windows[0].options.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false });
  });
  it('blocks navigation away from the local input page, denies popup windows and releases capture on close', () => {
    const capture = vi.fn();
    const chat = new ChatWindow({ preferences: () => DEFAULT_CHAT, state: () => ({ members: 0, active: false }), send: () => ({ ok: true }), save: vi.fn(), preview: vi.fn(), capture });
    chat.open(); const w = state.windows[0];
    const preventDefault = vi.fn();
    w.webContents.emit('will-navigate', { url: 'https://evil.example', preventDefault }); expect(preventDefault).toHaveBeenCalled();
    expect(w.webContents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' });
    w.emit('focus'); expect(capture).toHaveBeenLastCalledWith(true);
    chat.close(); expect(capture).toHaveBeenLastCalledWith(false);
    expect(state.handlers.get(CHAT_CH.send)!({ sender: w.webContents }, '关闭后')).toMatchObject({ ok: false });
  });
});
