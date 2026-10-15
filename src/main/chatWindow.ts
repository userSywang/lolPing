import { BrowserWindow, ipcMain, screen } from 'electron';
import { CHAT_CH, chatText, normalizeChat, type ChatMode, type ChatPreferences, type ChatSendResult } from '../shared/chat';
import { loadPage, pageUrl, preloadPath } from './paths';

interface ChatWindowDeps {
  preferences(): ChatPreferences;
  save(p: ChatPreferences): void;
  state(): { members: number; active: boolean };
  send(text: string, mode: ChatMode): ChatSendResult;
  preview(text: string, mode: ChatMode): void;
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
      deps.save(p);
      this.resize(p);
      return p;
    });
    ipcMain.handle(CHAT_CH.send, (event, raw: unknown, mode: unknown = 'random') => {
      if (!authorized(event.sender)) return { ok: false, error: '无效的输入窗口' };
      const text = chatText(raw);
      if (mode !== 'random' && mode !== 'announcement') return { ok: false, error: '请选择有效的消息通道' };
      return text ? deps.send(text, mode) : { ok: false, error: '请输入 1–100 个字符' };
    });
    ipcMain.handle(CHAT_CH.preview, (event, raw: unknown, mode: unknown = 'random') => {
      const text = chatText(raw);
      if (authorized(event.sender) && text && (mode === 'random' || mode === 'announcement')) deps.preview(text, mode);
    });
    ipcMain.on(CHAT_CH.close, (event) => { if (authorized(event.sender)) this.close(); });
  }

  private resize(p: ChatPreferences): void {
    if (!this.window) return;
    const bounds = this.window.getBounds();
    const area = screen.getDisplayNearestPoint(bounds).workArea;
    const { width, height } = this.size(p);
    this.window.setBounds({ width: Math.min(width, area.width), height: Math.min(height, area.height),
      x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
      y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))) });
  }

  private size(p: ChatPreferences): { width: number; height: number } {
    const font = p.mode === 'announcement' ? p.announcement.fontSize : p.fontSize;
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    return { width: Math.min(area.width, Math.max(360, Math.round(font * 14 + 150))), height: Math.min(area.height, Math.ceil(154 * font / 24) + 86) };
  }

  open(): void {
    if (this.window) { this.window.show(); this.window.focus(); return; }
    const bounds = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const { width, height } = this.size(this.deps.preferences());
    const cursor = screen.getCursorScreenPoint();
    const w = new BrowserWindow({ width, height, resizable: false, frame: false, transparent: true, hasShadow: false, skipTaskbar: true,
      x: Math.round(Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, cursor.x - width / 2))),
      y: Math.round(Math.max(bounds.y, Math.min(bounds.y + bounds.height - height, cursor.y + 20))),
      title: 'lolPing · 气泡输入', show: false, autoHideMenuBar: true, alwaysOnTop: true, backgroundColor: '#00000000',
      webPreferences: { preload: preloadPath('chat'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
    });
    this.window = w;
    w.removeMenu();
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.on('will-navigate', (event) => { if (event.url !== pageUrl('chat')) event.preventDefault(); });
    w.on('focus', () => { this.resize(this.deps.preferences()); this.deps.capture(true); });
    w.on('blur', () => this.deps.capture(false));
    w.on('closed', () => { this.window = null; this.deps.capture(false); });
    w.once('ready-to-show', () => { w.show(); w.focus(); });
    void loadPage(w, 'chat');
  }
  close(): void { this.window?.destroy(); }
}
