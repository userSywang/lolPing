/** Presentation only: the future room text channel can mount this without changing the frame asset. */
export interface CatBubbleOptions {
  text: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  compact?: boolean;
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
  // A long message needs the normal torso area even when the low-key preset is selected.
  if (options.compact && [...text.textContent].length <= 50) root.classList.add('cat-bubble--compact');
  const fontSize = clamp(options.fontSize ?? 24, 12, 32);
  root.style.setProperty('--cat-font-size', `${fontSize}px`);
  root.style.opacity = String(clamp(options.opacity ?? 1, .3, 1));
  if (options.color && /^#[0-9a-f]{6}$/i.test(options.color)) root.style.color = options.color;
  // Fit long text inside the actual painted torso, never on the paws. Refit when the container resizes.
  const fit = () => {
    if (!root.isConnected) return;
    const available = root.clientHeight * .43;
    let size = fontSize;
    text.style.fontSize = `${size}px`;
    while (text.scrollHeight > available && size > 10) text.style.fontSize = `${--size}px`;
  };
  requestAnimationFrame(fit);
  // A custom event keeps ownership/lifecycle with the caller, without a persistent observer per message.
  root.addEventListener('cat:refit', fit);
  return root;
}
