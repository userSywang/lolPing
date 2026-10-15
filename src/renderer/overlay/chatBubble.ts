/** Presentation only: the future room text channel can mount this without changing the frame asset. */
export interface CatBubbleOptions {
  text: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  compact?: boolean;
  maxWidth?: number;
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** Create a text-safe cat bubble; the frame's protected end caps never stretch horizontally. */
export function createCatBubble(options: CatBubbleOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cat-bubble';
  const text = document.createElement('span');
  text.className = 'cat-bubble__text';
  text.textContent = [...options.text].slice(0, 100).join('');
  root.append(text);
  const fontSize = clamp(options.fontSize ?? (options.compact ? 16 : 24), 12, 32);
  const scale = fontSize / 24;
  root.style.setProperty('--cat-font-size', `${fontSize}px`);
  root.style.setProperty('--cat-height', `${154 * scale}px`);
  root.style.minWidth = `${105 * scale}px`;
  root.style.maxWidth = `${Math.max(105 * scale, Math.min(600 * scale, options.maxWidth ?? 600 * scale))}px`;
  root.style.opacity = String(clamp(options.opacity ?? 1, .3, 1));
  if (options.color && /^#[0-9a-f]{6}$/i.test(options.color)) root.style.color = options.color;
  // Fit long text inside the actual painted torso, never on the paws. Refit when the container resizes.
  const fit = () => {
    if (!root.isConnected) return;
    text.style.fontSize = `${fontSize}px`;
    // Preserve the chosen font size. Grow the whole frame for extra lines, including proportional end caps.
    root.style.setProperty('--cat-height', `${Math.max(154 * scale, Math.ceil(text.scrollHeight / .43))}px`);
  };
  requestAnimationFrame(fit);
  // A custom event keeps ownership/lifecycle with the caller, without a persistent observer per message.
  root.addEventListener('cat:refit', fit);
  return root;
}
