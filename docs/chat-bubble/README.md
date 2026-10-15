# Long-cat chat bubble style

Local interactive preview: http://127.0.0.1:5183/bubbles.html (`npm run dev:site -- --host 127.0.0.1 --port 5183`). Production preview is also emitted at site-dist/bubbles.html by `npm run build:site`.

The reusable presentation component lives in src/renderer/overlay/chatBubble.ts and chatBubble.css. Import the CSS, createCatBubble({text, fontSize, color, opacity, compact}), then append the returned element. It fits once after mounting; a caller that changes the surrounding container can dispatch `cat:refit`. Text is assigned via textContent, never HTML. The preview's ResizeObserver recreates/refits on stage size changes.

Asset: assets/chat/long-cat-frame.png, 2032 x 774 RGBA, generated from the user-provided reference with fixed text and white background removed. The reference copy is reference.jpg. Horizontal border-image slices protect the left 500 and right 350 source pixels. Editable type is rendered separately. This preserves the long-cat style, but it is a generated adaptation rather than an exact extraction.

This change implements the style and interactive preview only. It does not add room chat transport, a native chat input, global shortcuts, persistent chat settings or a new installer. The existing emote-sync installation is unaffected.

Verification: TypeScript type check, Vite multi-page build, real in-app browser short/long/100-character states, office/playful presets, dark background, bounded placement and console check. See ../../design-qa.md.
