import type { ChatAppearance, ChatMode, ChatPreferences } from '../../shared/chat';
import { createCatBubble } from './chatBubble';
import './chatBubble.css';

interface Entry { node: HTMLElement; timer: ReturnType<typeof setTimeout>; peer: string; mode: ChatMode; p: ChatAppearance; scale: number }
/** Only transient messages; each sender owns one announcement slot. */
export class ChatStage {
  private live: Entry[] = [];
  constructor(private readonly layer: HTMLElement) {}
  private remove(item: Entry): void {
    clearTimeout(item.timer); item.node.remove(); this.live = this.live.filter((v) => v !== item);
  }
  clear(): void { for (const item of [...this.live]) this.remove(item); }
  configure(p: ChatPreferences): void {
    for (const item of [...this.live]) {
      const appearance = item.mode === 'announcement' ? p.announcement : p;
      if (!appearance.enabled) this.remove(item);
      else { item.p.x = appearance.x; item.p.y = appearance.y; }
    }
    this.arrange();
  }
  private arrange(): void {
    const announcements = this.live.filter((v) => v.mode === 'announcement' && v.node.style.visibility);
    if (!announcements.length) return;
    const p = announcements[0].p;
    // Choose the column count that preserves the largest readable scale while keeping every sender on screen.
    const gap = 8;
    const width = (item: Entry) => item.node.offsetWidth * item.scale;
    const height = (item: Entry) => item.node.offsetHeight * item.scale;
    const columnWidth = Math.max(...announcements.map(width));
    let columns: Entry[][] = [], fit = 0;
    for (let count = 1; count <= announcements.length; count++) {
      const rows = Math.ceil(announcements.length / count), candidate: Entry[][] = [];
      for (let i = 0; i < announcements.length; i += rows) candidate.push(announcements.slice(i, i + rows));
      const totalWidth = candidate.length * (columnWidth + gap) - gap;
      const totalHeight = Math.max(...candidate.map((column) => column.reduce((sum, item) => sum + height(item) + gap, -gap)));
      const scale = Math.min(1, Math.max(1, innerWidth - 32) / totalWidth, Math.max(1, innerHeight - 32) / totalHeight);
      if (scale > fit) { fit = scale; columns = candidate; }
    }
    const totalWidth = (columns.length * (columnWidth + gap) - gap) * fit;
    const left = 16 + Math.max(0, innerWidth - totalWidth - 32) * p.x;
    columns.forEach((column, index) => {
      const totalHeight = column.reduce((sum, v) => sum + height(v) + gap, -gap) * fit;
      let top = 16 + Math.max(0, innerHeight - totalHeight - 32) * p.y;
      for (const item of column) {
        item.node.style.transform = `scale(${item.scale * fit})`;
        item.node.style.left = `${left + index * (columnWidth + gap) * fit}px`;
        item.node.style.top = `${top}px`;
        item.node.style.visibility = 'visible';
        top += (height(item) + gap) * fit;
      }
    });
  }
  spawn(message: { text: string; name: string; peer: string; mode: ChatMode; x: number; y: number }, preferences: ChatPreferences): void {
    const mode = message.mode === 'announcement' ? 'announcement' : 'random';
    const p = mode === 'announcement' ? preferences.announcement : preferences;
    if (!p.enabled) return;
    if (mode === 'announcement') {
      const previous = this.live.find((v) => v.mode === mode && v.peer === message.peer);
      if (previous) this.remove(previous);
    } else {
      const random = this.live.filter((v) => v.mode === 'random');
      while (random.length >= 3) this.remove(random.shift()!);
    }
    const root = document.createElement('div'); root.className = 'chat-message'; root.dataset.mode = mode; root.dataset.peer = message.peer;
    const bubble = createCatBubble({ text: message.text, fontSize: p.fontSize, color: p.color, opacity: p.opacity,
      maxWidth: Math.max(180, Math.min(600 * p.fontSize / 24, innerWidth * .65)) });
    const tag = document.createElement('div'); tag.className = 'chat-message__name'; tag.textContent = message.name;
    root.append(bubble, tag); this.layer.append(root);
    const item: Entry = { node: root, peer: message.peer, mode, p: { ...p }, scale: 1, timer: setTimeout(() => { this.remove(item); this.arrange(); }, p.duration * 1000) };
    this.live.push(item);
    requestAnimationFrame(() => {
      if (!this.live.includes(item)) return;
      const scale = Math.min(1, (innerWidth - 32) / root.offsetWidth, (innerHeight - 32) / root.offsetHeight);
      item.scale = scale;
      root.style.transform = `scale(${scale})`;
      const width = root.offsetWidth * scale, height = root.offsetHeight * scale;
      const x = p.position === 'mouse' && mode === 'random' ? message.x + 18 : 16 + Math.random() * Math.max(0, innerWidth - width - 32);
      const y = p.position === 'mouse' && mode === 'random' ? message.y + 18 : 16 + Math.random() * Math.max(0, innerHeight - height - 32);
      root.style.left = `${Math.min(innerWidth - width - 16, Math.max(16, x))}px`;
      root.style.top = `${Math.min(innerHeight - height - 16, Math.max(16, y))}px`;
      root.style.visibility = 'visible';
      this.arrange();
    });
  }
}
