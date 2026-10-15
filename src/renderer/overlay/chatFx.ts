import type { ChatPreferences } from '../../shared/chat';
import { createCatBubble } from './chatBubble';
import './chatBubble.css';

/** Short-lived messages only: no transcript, storage, HTML insertion or body logging. */
export class ChatStage {
  private live: Array<{ node: HTMLElement; timer: ReturnType<typeof setTimeout> }> = [];
  constructor(private readonly layer: HTMLElement) {}
  clear(): void {
    for (const item of this.live) { clearTimeout(item.timer); item.node.remove(); }
    this.live = [];
  }
  spawn(message: { text: string; name: string; x: number; y: number }, p: ChatPreferences): void {
    if (!p.enabled) return;
    while (this.live.length >= 3) { const item = this.live.shift()!; clearTimeout(item.timer); item.node.remove(); }
    const root = document.createElement('div'); root.className = 'chat-message';
    const bubble = createCatBubble({ text: message.text, fontSize: p.fontSize, color: p.color, opacity: p.opacity,
      maxWidth: Math.max(180, Math.min(600 * p.fontSize / 24, innerWidth * .65)) });
    const tag = document.createElement('div'); tag.className = 'chat-message__name'; tag.textContent = message.name;
    root.append(bubble, tag); this.layer.append(root);
    const item = { node: root, timer: setTimeout(() => { root.remove(); this.live = this.live.filter((v) => v !== item); }, p.duration * 1000) };
    this.live.push(item);
    requestAnimationFrame(() => {
      const scale = Math.min(1, (innerWidth - 32) / root.offsetWidth, (innerHeight - 32) / root.offsetHeight);
      root.style.transform = `scale(${scale})`;
      const width = root.offsetWidth * scale, height = root.offsetHeight * scale;
      const x = p.position === 'random' ? 16 + Math.random() * Math.max(0, innerWidth - width - 32)
        : p.position === 'mouse' ? message.x + 18 : (innerWidth - width - 32) * p.x + 16;
      const y = p.position === 'random' ? 16 + Math.random() * Math.max(0, innerHeight - height - 32)
        : p.position === 'mouse' ? message.y + 18 : (innerHeight - height - 32) * p.y + 16;
      root.style.left = `${Math.min(innerWidth - width - 16, Math.max(16, x))}px`;
      root.style.top = `${Math.min(innerHeight - height - 16, Math.max(16, y))}px`;
      root.style.visibility = 'visible';
      if (p.position === 'fixed') {
        // Stack actual rendered heights: mixed font sizes must not overlap a preceding larger cat.
        let offset = 0;
        for (const entry of [...this.live].reverse()) {
          const box = entry.node.getBoundingClientRect();
          const top = (innerHeight - box.height - 32) * p.y + 16 - offset;
          entry.node.style.left = `${Math.max(16, (innerWidth - box.width - 32) * p.x + 16)}px`;
          entry.node.style.top = `${Math.max(16, top)}px`;
          entry.node.style.visibility = top < 16 && offset > 0 ? 'hidden' : 'visible';
          offset += box.height + 8;
        }
      }
    });
  }
}
