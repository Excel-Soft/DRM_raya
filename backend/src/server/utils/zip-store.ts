/**
 * Minimal streaming ZIP writer (STORE method, no compression) — enough for
 * bundling already-compressed images without adding a dependency.
 * Uses Node's built-in zlib.crc32 (Node >= 20.15). Zip32 only: keep the
 * archive under 4 GB and 65535 entries (callers cap the selection).
 */
import zlib from "zlib";
import type { Writable } from "stream";

interface Entry { name: Buffer; crc: number; size: number; offset: number; time: number; date: number }

function dosDateTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export class ZipStoreWriter {
  private entries: Entry[] = [];
  private offset = 0;
  constructor(private out: Writable) {}

  private write(buf: Buffer): Promise<void> {
    this.offset += buf.length;
    return new Promise((resolve, reject) => {
      if (this.out.write(buf)) return resolve();
      const onDrain = () => { this.out.off("error", onError); resolve(); };
      const onError = (e: Error) => { this.out.off("drain", onDrain); reject(e); };
      this.out.once("drain", onDrain);
      this.out.once("error", onError);
    });
  }

  async addFile(fileName: string, data: Buffer, mtime = new Date()) {
    const name = Buffer.from(fileName, "utf8");
    const crc = zlib.crc32(data) >>> 0;
    const { time, date } = dosDateTime(mtime);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);          // version needed
    h.writeUInt16LE(0x0800, 6);      // UTF-8 names
    h.writeUInt16LE(0, 8);           // STORE
    h.writeUInt16LE(time, 10);
    h.writeUInt16LE(date, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26);
    h.writeUInt16LE(0, 28);
    this.entries.push({ name, crc, size: data.length, offset: this.offset, time, date });
    await this.write(h);
    await this.write(name);
    await this.write(data);
  }

  async finish() {
    const cdStart = this.offset;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(20, 4);        // version made by
      c.writeUInt16LE(20, 6);        // version needed
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(0, 10);
      c.writeUInt16LE(e.time, 12);
      c.writeUInt16LE(e.date, 14);
      c.writeUInt32LE(e.crc, 16);
      c.writeUInt32LE(e.size, 20);
      c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.name.length, 28);
      // extra len, comment len, disk no., internal attrs = 0
      c.writeUInt32LE(0, 38);        // external attrs
      c.writeUInt32LE(e.offset, 42);
      await this.write(c);
      await this.write(e.name);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - cdStart, 12);
    end.writeUInt32LE(cdStart, 16);
    await this.write(end);
  }
}
