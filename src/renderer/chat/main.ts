import './chat.css';
import { DEFAULT_CHAT, type ChatApi, type ChatPreferences } from '../../shared/chat';
import { createCatBubble } from '../overlay/chatBubble';
declare global { interface Window { chatApi: ChatApi } }
const api = window.chatApi;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = get<HTMLTextAreaElement>('message');
let preferences: ChatPreferences = { ...DEFAULT_CHAT };
let composing = false, busy = false, saving: Promise<unknown> = Promise.resolve();
const ids = ['size','color','opacity','duration','position','x','y','enabled'];
function paint() {
  get('count').textContent = `${[...message.value].length} / 100`;
  get('size-value').textContent = `${preferences.fontSize} px`;
  get('opacity-value').textContent = `${Math.round(preferences.opacity * 100)}%`;
  get('duration-value').textContent = `${preferences.duration} 秒`;
  const area = get('preview-area');
  const bubble = createCatBubble({ text: message.value || 'hi! 大家好', fontSize: preferences.fontSize, color: preferences.color, opacity: preferences.opacity, maxWidth: 400 });
  area.replaceChildren(bubble);
  requestAnimationFrame(() => {
    const scale = Math.min(1, (area.clientWidth - 4) / bubble.offsetWidth, 150 / bubble.offsetHeight);
    bubble.style.transform = `scale(${scale})`;
  });
}
function controls() {
  for (const [id,value] of Object.entries({ size:preferences.fontSize,color:preferences.color,opacity:preferences.opacity*100,duration:preferences.duration,position:preferences.position,x:preferences.x*100,y:preferences.y*100 })) get<HTMLInputElement>(id).value = String(value);
  get<HTMLInputElement>('enabled').checked = preferences.enabled;
  paint();
}
function save() {
  const snapshot = { ...preferences };
  saving = saving.then(() => api.preferences(snapshot)).catch(() => { get('status').textContent = '设置保存失败，请重试'; });
  paint();
}
async function send() {
  if (busy || composing) return;
  busy = true; get<HTMLButtonElement>('send').disabled = true;
  try {
    await saving;
    const result = await api.send(message.value);
    if (result.ok) { message.value = ''; api.close(); }
    else get('status').textContent = result.error;
  } catch { get('status').textContent = '发送失败，请检查房间连接'; }
  finally { busy = false; get<HTMLButtonElement>('send').disabled = false; }
}
message.addEventListener('compositionstart', () => { composing = true; });
message.addEventListener('compositionend', () => { composing = false; paint(); });
message.addEventListener('input', () => { if (!composing) { if ([...message.value].length > 100) message.value = [...message.value].slice(0,100).join(''); paint(); } });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.isComposing && !composing) { message.value = ''; api.close(); }
  if (event.key === 'Enter' && event.target === message && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) { event.preventDefault(); void send(); }
});
get('send').addEventListener('click', () => void send());
get('preview').addEventListener('click', () => { void saving.then(() => api.preview(message.value || 'hi! 大家好')); });
for (const id of ids) get(id).addEventListener('change', () => {
  const value = get<HTMLInputElement>(id).value;
  if (id === 'size') preferences.fontSize = Number(value);
  else if (id === 'opacity') preferences.opacity = Number(value) / 100;
  else if (id === 'duration') preferences.duration = Number(value);
  else if (id === 'x' || id === 'y') preferences[id] = Number(value) / 100;
  else if (id === 'enabled') preferences.enabled = get<HTMLInputElement>(id).checked;
  else if (id === 'position') preferences.position = value as ChatPreferences['position'];
  else preferences.color = value;
  save();
});
get('office').addEventListener('click', () => { preferences = { ...preferences, fontSize:16,opacity:.6,position:'fixed',duration:4 }; controls(); save(); });
get('playful').addEventListener('click', () => { preferences = { ...preferences, fontSize:24,opacity:1,duration:6 }; controls(); save(); });
void api.get().then((state) => {
  preferences = state.preferences; controls();
  get('status').textContent = state.active ? `当前有 ${state.members} 位好友支持文字聊天` : '先在设置 → 房间中加入或创建房间，也可以先本机预览';
  message.focus();
});
