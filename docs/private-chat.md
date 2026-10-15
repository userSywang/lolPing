# 0.5.4 更新

输入与设置已分离，新增独立公告通道。当前交互、兼容性和默认值以 [chat-modes.md](chat-modes.md) 为准；下文保留加密设计与 0.5.3 初版背景。

# Desktop private chat — 0.5.3-privatechat.1

The native composer opens from Settings > 悄悄话, the tray menu, or Ctrl+Alt+Enter. It has a sandboxed, isolated preload exposing only five chat operations. Main-process handlers check sender WebContents identity, validate text and normalize preferences. Popup windows and navigation away from the packaged chat page are blocked. IME composition/229 confirmations do not submit. Enter sends, Shift+Enter inserts a newline and Esc destroys the draft window. The input helper is suspended while the composer has focus and resumed on blur/close. Ctrl+Alt+Backspace destroys the composer and clears text overlays. If a global shortcut is occupied, the tray/settings entry remains available.

Each room presence advertises optional chat:1. Old clients continue using pings/emotes but ignore text. Sending requires an active room and a capable peer. Text is limited to 100 Unicode code points, validated in the main process and protocol decoder. Outgoing and incoming text have bounded token buckets, in addition to the room receive budget. Member mute, room mute and application pause gates apply. No delivery receipts or persistent history are implemented; these are ephemeral desktop messages.

## Encryption boundary
Text is encoded into the existing RoomManager sendShared path and sealed before entering any transport. AES-256-GCM uses a fresh random 12-byte nonce and 16-byte authentication tag for each message. Keys are derived locally from the random room code with the existing scrypt/HKDF derivation; no keys are transmitted to relays. LAN sends the sealed packet over UDP; internet relays receive a signed Nostr event whose content is only base64 ciphertext. Type, sender metadata and text are all inside the authenticated ciphertext. Alteration and replay are rejected.

A relay/server without the room code cannot decrypt the content. It still sees network addresses, anonymous room topics, traffic timing and message sizes. Anyone who obtains the room code and joins the room can read room messages. This is shared-room encryption, not independently authenticated identities or forward secrecy. Messages must exist briefly as plaintext on participating devices to be displayed; this does not hide content from a compromised endpoint or screen capture. The local settings file already stores a remembered room code when rejoin is enabled. Keep that file and the code private.

## Persistence
The composer holds a transient draft and destroys its window on close/send; autocomplete and spellcheck are off. Message bodies are not passed to SettingsStore, application logs, an analytics endpoint or a transcript store. Only display preferences are saved as settings.chat. On-screen messages are limited to three and removed after 3–15 seconds or clear/leave/pause. This policy describes application-managed persistence, not OS memory/pagefile or third-party captures.

## Rendering
The recipient controls their own font size, opacity, color, duration and placement. Fixed position uses normalized X/Y sliders; mouse mode uses the recipient's current cursor/display; random mode keeps the whole bubble inside the primary display. Font size 12–32 scales text, frame, head, tail and paws together. Long text grows the torso/frame without lowering the selected font. An oversized whole bubble is scaled down only to fit the screen. Fixed-position messages stack by their actual rendered heights; older bubbles beyond the available area are hidden rather than overlapping. Text/name use textContent, never HTML.

## Verification
735 tests pass across 49 files, including actual loopback UDP with two clients and signed RelayTransport events through a simulated relay. Relay capture contains neither plaintext nor room code; recipients recover the text. Wrong-key, modified-message, replay, mute/pause, rate-limit and IPC-origin tests pass. Type check and application build pass. Real Electron isolated-profile smoke checks the packaged composer, a 12px frame height of 77px and a 32px height of 205.328px, Chinese IME confirmation, shortcut registration, clear and absence of draft text in settings. A screenshot is saved at release/chat-composer-preview.png. Live public-relay testing between the user's and a friend's actual networks remains a user acceptance step.

The installer keeps the same app ID and configuration location. Original input helper and Electron 44.5.1 runtime are reused; no dependency versions were changed. Official automatic update integration remains disabled in this custom build.
