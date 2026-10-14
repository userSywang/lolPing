import { EventEmitter } from 'node:events';
import { isCustomRef } from '../shared/emotes';
import { EMOTE_CHUNK_BYTES, type EmoteAssetBody, type EmoteAssetMsg } from '../shared/roomProtocol';
import { EmoteCache, validEmoteStill } from './emoteCache';

interface Download {
  peer: string;
  ref: string;
  parts: Buffer[];
  total: number | null;
  attempts: number;
  next: number;
  expires: number;
  saving: boolean;
}
interface SyncDeps {
  cache: EmoteCache;
  readLocal(ref: string): Promise<Uint8Array | null>;
  send(peer: string, body: EmoteAssetBody): boolean;
}

/** Pull one block at a time: dropped packets are retried, and every message stays within the existing 1200-byte cap. */
export class EmoteSync extends EventEmitter {
  private readonly downloads = new Map<string, Download>();
  private readonly offered = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  constructor(private readonly deps: SyncDeps) { super(); }

  offer(ref: string): void {
    if (!isCustomRef(ref)) return;
    for (const [e, until] of this.offered) if (until < Date.now()) this.offered.delete(e);
    this.offered.set(ref, Date.now() + 60_000);
    if (this.offered.size > 24) this.offered.delete(this.offered.keys().next().value!);
  }

  want(peer: string, ref: string): void {
    if (!isCustomRef(ref) || this.deps.cache.has(ref)) return;
    const key = `${peer}/${ref}`;
    if (this.downloads.has(key) || this.downloads.size >= 8) return;
    this.downloads.set(key, { peer, ref, parts: [], total: null, attempts: 0, next: 0, expires: Date.now() + 45_000, saving: false });
    this.timer ??= setInterval(() => this.pump(), 400);
  }

  async receive(msg: EmoteAssetMsg): Promise<void> {
    const generation = this.generation;
    if (msg.t === 'emoteRequest') {
      if ((this.offered.get(msg.e) ?? 0) <= Date.now()) return;
      const bytes = await this.deps.readLocal(msg.e).catch(() => null);
      if (generation !== this.generation || !bytes || !validEmoteStill(msg.e, bytes)) return;
      const start = msg.i * EMOTE_CHUNK_BYTES;
      if (start >= bytes.length) return;
      this.deps.send(msg.peer, { t: 'emoteChunk', e: msg.e, i: msg.i, total: bytes.length,
        data: Buffer.from(bytes.subarray(start, start + EMOTE_CHUNK_BYTES)).toString('base64') });
      return;
    }
    const key = `${msg.peer}/${msg.e}`;
    const d = this.downloads.get(key);
    if (!d || d.saving || d.attempts === 0 || d.expires < Date.now() || msg.i !== d.parts.length) return;
    if (d.total !== null && d.total !== msg.total) return;
    d.total = msg.total;
    d.parts.push(Buffer.from(msg.data, 'base64'));
    d.attempts = 0; d.next = 0;
    if (d.parts.length * EMOTE_CHUNK_BYTES < msg.total) return;
    d.saving = true;
    const bytes = Buffer.concat(d.parts);
    if (bytes.length === msg.total && await this.deps.cache.put(d.ref, bytes)) {
      if (generation === this.generation) this.emit('ready', d.peer, d.ref);
    }
    if (this.downloads.get(key) === d) this.downloads.delete(key);
  }

  reset(): void {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.downloads.clear(); this.offered.clear();
  }

  private pump(): void {
    const now = Date.now();
    for (const [key, d] of this.downloads) {
      if (d.expires <= now || (d.attempts >= 4 && d.next <= now)) { this.downloads.delete(key); continue; }
      if (d.saving || d.next > now) continue;
      if (this.deps.send(d.peer, { t: 'emoteRequest', e: d.ref, i: d.parts.length })) {
        d.attempts++; d.next = now + 2000;
        // Round-robin when several members send new images together.
        this.downloads.delete(key); this.downloads.set(key, d);
      }
      break;
    }
    if (this.downloads.size === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
