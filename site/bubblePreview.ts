import './bubblePreview.css';
import { createCatBubble } from '../src/renderer/overlay/chatBubble';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = el<HTMLTextAreaElement>('message');
const size = el<HTMLInputElement>('size');
const opacity = el<HTMLInputElement>('opacity');
const color = el<HTMLInputElement>('color');
const position = el<HTMLSelectElement>('position');
const stage = el<HTMLDivElement>('stage');
const mount = el<HTMLDivElement>('bubble-mount');
let compact = false;
let pointer: { x: number; y: number } | null = null;
let lastRandom: { x: number; y: number } | null = null;

function place(randomize = false) {
  const bounds = stage.getBoundingClientRect();
  const box = mount.getBoundingClientRect();
  const minX = 12, minY = 40;
  const maxX = Math.max(minX, bounds.width - box.width - 12);
  const maxY = Math.max(minY, bounds.height - box.height - 12);
  let x = maxX, y = maxY;
  if (position.value === 'mouse' && pointer) { x = pointer.x + 16; y = pointer.y + 16; }
  if (position.value === 'random') {
    if (randomize || !lastRandom) lastRandom = { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
    ({ x, y } = lastRandom);
  }
  mount.style.transform = 'none';
  mount.style.left = `${Math.max(minX, Math.min(maxX, x))}px`;
  mount.style.top = `${Math.max(minY, Math.min(maxY, y))}px`;
}

function render(randomize = false) {
  const chars = [...message.value].slice(0, 100);
  if ([...message.value].length > 100) message.value = chars.join('');
  el('count').textContent = `${chars.length} / 100`;
  el('size-value').textContent = `${size.value} px`;
  el('opacity-value').textContent = `${opacity.value}%`;
  stage.style.setProperty('--stage-width', `${stage.clientWidth}px`);
  mount.replaceChildren(createCatBubble({ text: chars.join('') || '猫猫在等你说话…', fontSize: Number(size.value), color: color.value,
    opacity: Number(opacity.value) / 100, compact }));
  requestAnimationFrame(() => place(randomize));
}

function preset(isOffice: boolean) {
  compact = isOffice;
  size.value = isOffice ? '16' : '24';
  opacity.value = isOffice ? '60' : '100';
  el('office').setAttribute('aria-pressed', String(isOffice));
  el('playful').setAttribute('aria-pressed', String(!isOffice));
  el('feedback').textContent = isOffice ? '小一号、无声、淡一点。这里仅预览，不会打断其他窗口。' : '鼠标附近模式下，在左侧预览区域移动鼠标。';
  render();
}
message.addEventListener('input', (e) => { if (!(e as InputEvent).isComposing) render(); });
message.addEventListener('compositionend', () => render());
for (const input of [size, opacity, color]) input.addEventListener('input', () => render());
position.addEventListener('change', () => render(true));
el('playful').addEventListener('click', () => preset(false));
el('office').addEventListener('click', () => preset(true));
el('background').addEventListener('click', () => {
  const dark = stage.classList.toggle('dark');
  el('background').textContent = dark ? '切换浅色背景' : '切换深色背景';
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-message]')) {
  button.addEventListener('click', () => { message.value = button.dataset.message!; render(); });
}
el('preview').addEventListener('click', () => {
  render(true);
  mount.classList.remove('is-popping'); void mount.offsetWidth; mount.classList.add('is-popping');
});
stage.addEventListener('pointermove', (e) => {
  const bounds = stage.getBoundingClientRect(); pointer = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
  if (position.value === 'mouse') place();
});
new ResizeObserver(() => render()).observe(stage);
el<HTMLFormElement>('controls').addEventListener('submit', (e) => e.preventDefault());
render();
