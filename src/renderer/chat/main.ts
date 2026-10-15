import './chat.css';
import { DEFAULT_CHAT, type ChatApi, type ChatMode, type ChatPreferences } from '../../shared/chat';
declare global { interface Window { chatApi: ChatApi } }
const api = window.chatApi;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = get<HTMLTextAreaElement>('message');
let preferences: ChatPreferences = { ...DEFAULT_CHAT };
let composing = false, busy = false, revision = 0, saving: Promise<unknown> = Promise.resolve();
function paint() {
  const p = preferences.mode === 'announcement' ? preferences.announcement : preferences;
  const bubble = get('input-bubble');
  bubble.style.setProperty('--cat-height', `${154 * p.fontSize / 24}px`);
  bubble.style.setProperty('--cat-font-size', `${p.fontSize}px`);
  bubble.style.color = p.color;
  get('count').textContent = `${[...message.value].length}/100`;
  for (const mode of ['random', 'announcement']) get(mode).setAttribute('aria-pressed', String(preferences.mode === mode));
  message.placeholder = preferences.mode === 'announcement' ? '更新我的公告…' : '让猫猫说一句…';
}
async function send() {
  if (busy || composing) return;
  const text = message.value, mode = preferences.mode;
  busy = true; get<HTMLButtonElement>('send').disabled = true;
  for (const channel of ['random', 'announcement']) get<HTMLButtonElement>(channel).disabled = true;
  try {
    await saving;
    const result = await api.send(text, mode);
    if (result.ok) { message.value = ''; api.close(); }
    else { get('status').textContent = result.error; get('status').title = result.error; }
  } catch { get('status').textContent = '发送失败，请检查房间连接'; }
  finally {
    busy = false; get<HTMLButtonElement>('send').disabled = false;
    for (const channel of ['random', 'announcement']) get<HTMLButtonElement>(channel).disabled = false;
  }
}
for (const mode of ['random', 'announcement'] as ChatMode[]) get(mode).addEventListener('click', () => {
  revision++;
  preferences = { ...preferences, mode };
  saving = saving.then(() => api.preferences({ mode })).catch(() => { get('status').textContent = '通道选择保存失败'; });
  paint(); message.focus();
});
message.addEventListener('compositionstart', () => { composing = true; });
message.addEventListener('compositionend', () => { composing = false; limit(); });
function limit() { if (!composing) { message.value = [...message.value].slice(0,100).join(''); paint(); } }
message.addEventListener('input', limit);
document.addEventListener('keydown', (event) => {
  if (event.isComposing || composing || event.keyCode === 229) return;
  if (event.key === 'Escape') { message.value = ''; api.close(); }
  if (event.key === 'Enter' && event.target === message && !event.shiftKey) { event.preventDefault(); void send(); }
});
get('send').addEventListener('click', () => void send());
get('close').addEventListener('click', () => api.close());
async function refresh() {
  const requested = revision;
  const state = await api.get();
  if (requested !== revision || busy) return;
  preferences = state.preferences; paint();
  if (!state.active) get('status').textContent = '请先加入房间';
  else if (!state.members) get('status').textContent = '等待支持文字聊天的好友上线';
  else get('status').textContent = 'Enter 发送 · Esc 收起';
  message.focus();
}
window.addEventListener('focus', () => { if (!busy) void refresh(); });
void refresh();
