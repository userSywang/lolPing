# Long-cat bubble design QA

Source visual truth: docs/chat-bubble/reference.jpg (440 x 336 pixels).
Implementation: http://127.0.0.1:5183/bubbles.html.
Browser-rendered implementation screenshot: docs/chat-bubble/preview-cat.png (1295 x 1012 pixels).
Additional states: docs/chat-bubble/preview-long.png and preview-office.png.
Viewport: 1295 x 1012 CSS pixels for the final desktop capture. Native screenshot density is 1. The source is a standalone illustration; compare the cat component, not the surrounding preview controls. Different cat/text scale is deliberate for a configurable desktop bubble, not a screenshot clone.
State: playful preset, text "hi! 大家好", 24px maximum font size, 100% opacity, fixed corner position.

## Full-view comparison evidence
The reference image and final rendered screenshot were opened together in the same tool comparison input. Both show a tan long cat with a head on the left, upright tail on the right, dangling white paws and dark hand-drawn outlines. The generated transparent frame removes the fixed reference lettering and floor shadow intentionally. This is a style adaptation: the eyes, texture and some contour details differ from the original. They are not represented as a pixel-identical extraction.

## Focused comparison evidence
The source illustration and 2032 x 774 RGBA frame asset were visually inspected, followed by the browser component at short and long text lengths. The component's text, face, paws and edge slices are readable in preview-cat.png; the 32-character two-line state is in preview-long.png. Full-height source slices preserve face/tail/paw proportions while only the torso stretches horizontally. Alpha was checked to span 0..255, with white paw fur retained. Dark-background verification is captured in preview-office.png.

## Findings and comparison history
- Initial P1: frame asset path resolved one directory too high, showing text without a cat. Fixed the CSS URL to the repository asset. Recaptured the actual browser showing the frame and checked the final preview against the reference.
- P2 edge case: long messages in the compact office preset need more torso area. For messages over 50 code points the renderer retains the normal-sized torso with the office opacity/font preference. Post-fix browser test: 100 code points render at 12px, text height 62.375px within 66.22px available. Head/tail slice values remain unchanged.
- P3: generated eyes and texture vary slightly from the supplied drawing. Accepted for the requested visual style; exact-source extraction is not claimed.

## Required fidelity surfaces
- Typography: editable real text, Microsoft YaHei/Segoe UI fallback, dark regular-weight type; font size adjusts downward for long messages. Chinese and explicit line breaks are supported.
- Layout: protected head/tail/paws, intrinsic torso width with maximum width; no visible clipping in tested desktop states. Random and mouse-adjacent modes were checked to keep the entire bubble inside the stage.
- Colors: warm tan frame, dark outlines/text, transparent surround. User-selected opacity intentionally reduces contrast in the low-key preset; default full-opacity text remains readable.
- Image quality: genuine raster illustration with alpha, no CSS/SVG imitation; no opaque white box on the dark stage.
- Copy: editable "hi! 大家好" reproduces the reference wording; preview controls explicitly state that messages are not sent to friends and room text transport is not yet connected.

## Primary interactions tested
Short greeting; 32-character wrap; 100-code-point limit and text fit; playful/office preset changes; light/dark background; fixed/random/mouse-adjacent placement; preview animation. Browser console checked: no warnings or errors. Type check and Vite multi-page production build passed.

## Residual test gaps
The requested browser viewport override did not produce a verified 390px viewport; no mobile fidelity claim is made. This is a desktop-app style preview. IME composition has dedicated input/composition-end handling, but a complete room chat input, real networking, global shortcuts and a new desktop installer are outside this style-only change. Extreme manual line-break patterns have not been exhaustively tested.

## Implementation checklist
- [x] Save transparent project-owned asset and reusable DOM/CSS component.
- [x] Provide working local preview controls and build output.
- [x] Compare reference and rendered result; fix blocking findings.
- [x] Keep verified preview open.

final result: passed
