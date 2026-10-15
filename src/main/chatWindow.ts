import { BrowserWindow, ipcMain, screen } from 'electron';
import { CHAT_CH, chatText, normalizeChat, type ChatPreferences, type ChatSendResult } from '../shared/chat';
import { loadPage, pageUrl, preloadPath } from './paths';

interface ChatWindowDeps {
  preferences(): ChatPreferences;
  save(p: ChatPreferences): void;
  state(): { members: number; active: boolean };
  send(text: string): ChatSendResult;
  preview(text: string): void;
  capture(on: boolean): void;
}

/** The composer owns only a transient draft; it never receives room keys or writes message content to disk. */
export class ChatWindow {
  private window: BrowserWindow | null = null;
  constructor(private readonly deps: ChatWindowDeps) {
    const authorized = (sender: Electron.WebContents) => this.window?.webContents === sender;
    ipcMain.handle(CHAT_CH.get, (event) => authorized(event.sender) ? { preferences: deps.preferences(), ...deps.state() } : null);
    ipcMain.handle(CHAT_CH.preferences, (event, patch: unknown) => {
      if (!authorized(event.sender)) throw new Error('unauthorized composer');
      const p = normalizeChat({ ...deps.preferences(), ...(typeof patch === 'object' && patch !== null ? patch : {}) });
      deps.save(p); return p;
    });
    ipcMain.handle(CHAT_CH.send, (event, raw: unknown) => {
      if (!authorized(event.sender)) return { ok: false, error: '无效的输入窗口' };
      const text = chatText(raw);
      return text ? deps.send(text) : { ok: false, error: '请输入 1–100 个字符' };
    });
    ipcMain.handle(CHAT_CH.preview, (event, raw: unknown) => {
      const text = chatText(raw);
      if (authorized(event.sender) && text) deps.preview(text);
    });
    ipcMain.on(CHAT_CH.close, (event) => { if (authorized(event.sender)) this.close(); });
  }

  open(): void {
    if (this.window) { this.window.show(); this.window.focus(); return; }
    const bounds = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const width = Math.min(530, bounds.width), height = Math.min(640, bounds.height);
    const w = new BrowserWindow({ width, height, minWidth: Math.min(400, width), minHeight: Math.min(440, height),
      x: Math.round(bounds.x + (bounds.width - width) / 2), y: Math.round(bounds.y + (bounds.height - height) / 2),
      title: 'lolPing · 桌面悄悄话', show: false, autoHideMenuBar: true, alwaysOnTop: true, backgroundColor: '#f5f6f2',
      webPreferences: { preload: preloadPath('chat'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
    });
    this.window = w;
    w.removeMenu();
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.on('will-navigate', (event) => { if (event.url !== pageUrl('chat')) event.preventDefault(); });
    w.on('focus', () => this.deps.capture(true));
    w.on('blur', () => this.deps.capture(false));
    w.on('closed', () => { this.window = null; this.deps.capture(false); });
    w.once('ready-to-show', () => { w.show(); w.focus(); });
    void loadPage(w, 'chat');
  }
  close(): void { this.window?.destroy(); }
}
