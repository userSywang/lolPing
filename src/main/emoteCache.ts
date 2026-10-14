import { createHash } from 'node:crypto';
import { mkdir, open, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { customHash, isCustomRef, STILL_MAX_BYTES } from '../shared/emotes';
import { checkStill } from './emoteLibrary';

export function validEmoteStill(ref: string, bytes: Uint8Array): boolean {
  return isCustomRef(ref) && bytes.length <= STILL_MAX_BYTES && checkStill(bytes) === null &&
    createHash('sha256').update(bytes).digest('hex').slice(0, 32) === customHash(ref);
}

/** Received stills are separate from the user's collection. Bounded to 256 files (at most 3 MiB). */
export class EmoteCache {
  private readonly known = new Set<string>();
  private writes: Promise<unknown> = Promise.resolve();
  constructor(readonly dir: string, private readonly capacity = 256) {}

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    for (const name of await readdir(this.dir)) {
      if (!/^[0-9a-f]{32}\.webp$/.test(name)) continue;
      const ref = `c:${name.slice(0, 32)}`;
      // Bound the read before bringing an on-disk file into memory.
      const bytes = await this.readBounded(name);
      if (bytes && validEmoteStill(ref, bytes)) this.known.add(ref);
      else await rm(join(this.dir, name), { force: true }).catch(() => undefined);
    }
    await this.trim();
  }

  has(ref: string): boolean {
    if (!this.known.has(ref)) return false;
    this.known.delete(ref); this.known.add(ref);
    return true;
  }

  put(ref: string, bytes: Uint8Array): Promise<boolean> {
    if (!validEmoteStill(ref, bytes)) return Promise.resolve(false);
    const task = this.writes.then(async () => {
      const path = join(this.dir, `${customHash(ref)}.webp`);
      try {
        await mkdir(this.dir, { recursive: true });
        await writeFile(`${path}.tmp`, bytes);
        await rename(`${path}.tmp`, path);
        this.known.delete(ref); this.known.add(ref);
        await this.trim();
        return true;
      } catch {
        await rm(`${path}.tmp`, { force: true }).catch(() => undefined);
        return false;
      }
    });
    this.writes = task;
    return task;
  }

  private async readBounded(name: string): Promise<Buffer | null> {
    try {
      const file = await open(join(this.dir, name), 'r');
      try {
        if ((await file.stat()).size > STILL_MAX_BYTES) return null;
        const buffer = Buffer.alloc(STILL_MAX_BYTES + 1);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        return bytesRead <= STILL_MAX_BYTES ? buffer.subarray(0, bytesRead) : null;
      } finally { await file.close(); }
    } catch { return null; }
  }

  private async trim(): Promise<void> {
    while (this.known.size > this.capacity) {
      const oldest = this.known.values().next().value!;
      await rm(join(this.dir, `${customHash(oldest)}.webp`), { force: true });
      this.known.delete(oldest);
    }
  }
}
