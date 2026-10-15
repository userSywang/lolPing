import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHAT, normalizeChat } from '../../src/shared/chat';
vi.mock('../../src/renderer/overlay/chatBubble', () => ({ createCatBubble: () => new Element() }));
import { ChatStage } from '../../src/renderer/overlay/chatFx';

class Element {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: Element[] = [];
  parent?: Element;
  className = ''; textContent = ''; offsetWidth = 240; offsetHeight = 90;
  append(...nodes: Element[]) { for (const node of nodes) { this.children.push(node); node.parent = this; } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((v) => v !== this); }
  getBoundingClientRect() { const scale = Number(this.style.transform?.match(/scale\(([^)]+)\)/)?.[1] ?? 1); return { width: 240 * scale, height: 90 * scale }; }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { createElement: () => new Element() });
  vi.stubGlobal('innerWidth', 1200); vi.stubGlobal('innerHeight', 600);
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => fn());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const msg = (peer: string, text: string, mode: 'announcement' | 'random' = 'announcement') => ({ peer, text, mode, name: peer, x: 0, y: 0 });
describe('independent desktop message channels', () => {
  it('replaces only the sender announcement, resets its timer, and expires random messages independently', () => {
    const layer = new Element(), stage = new ChatStage(layer as unknown as HTMLElement);
    const p = normalizeChat({ duration: 3 });
    stage.spawn(msg('alice', 'A1'), p); stage.spawn(msg('bob', 'B1'), p); stage.spawn(msg('alice', 'hello', 'random'), p);
    expect(layer.children).toHaveLength(3);
    vi.advanceTimersByTime(5000); expect(layer.children).toHaveLength(2);
    stage.spawn(msg('alice', 'A2'), p);
    expect(layer.children).toHaveLength(2);
    expect(layer.children.filter((v) => v.dataset.peer === 'alice')).toHaveLength(1);
    expect(layer.children.find((v) => v.dataset.peer === 'alice')!.children[1].textContent).toBe('alice');
    vi.advanceTimersByTime(56000);
    expect(layer.children.map((v) => v.dataset.peer)).toEqual(['alice']);
    vi.advanceTimersByTime(4000); expect(layer.children).toHaveLength(0);
  });
  it('caps only random messages and switches each channel off independently', () => {
    const layer = new Element(), stage = new ChatStage(layer as unknown as HTMLElement);
    stage.spawn(msg('alice', '公告'), DEFAULT_CHAT);
    for (let i = 0; i < 6; i++) stage.spawn(msg('bob', String(i), 'random'), DEFAULT_CHAT);
    expect(layer.children).toHaveLength(4);
    stage.configure(normalizeChat({ announcement: { enabled: false } }));
    expect(layer.children).toHaveLength(3);
    expect(layer.children.every((v) => v.dataset.mode === 'random')).toBe(true);
    stage.clear(); expect(layer.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('arranges different senders without overlap, wrapping into columns', () => {
    const layer = new Element(), stage = new ChatStage(layer as unknown as HTMLElement);
    for (let i = 0; i < 7; i++) stage.spawn(msg(String(i), '公告'), DEFAULT_CHAT);
    const boxes = layer.children.map((v) => ({ x: parseFloat(v.style.left), y: parseFloat(v.style.top) }));
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      expect(Math.abs(boxes[a].x - boxes[b].x) >= 240 || Math.abs(boxes[a].y - boxes[b].y) >= 90).toBe(true);
    }
    expect(layer.children.every((v) => v.style.visibility === 'visible')).toBe(true);
  });
  it('fits every sender on a small screen instead of hiding overflow announcements', () => {
    vi.stubGlobal('innerWidth', 480); vi.stubGlobal('innerHeight', 200);
    const layer = new Element(), stage = new ChatStage(layer as unknown as HTMLElement);
    for (let i = 0; i < 8; i++) stage.spawn(msg(String(i), '公告'), DEFAULT_CHAT);
    for (const node of layer.children) {
      const box = node.getBoundingClientRect(), x = parseFloat(node.style.left), y = parseFloat(node.style.top);
      expect(node.style.visibility).toBe('visible');
      expect(x + box.width).toBeLessThanOrEqual(464.01);
      expect(y + box.height).toBeLessThanOrEqual(184.01);
    }
  });
});
