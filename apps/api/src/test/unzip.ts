import { inflateRawSync } from "node:zlib";

/** Reads a ZIP's central directory and each entry back, as an unzip tool would (for tests of the export, P6-10). */
export function unzip(z: Buffer) {
  const end = z.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = z.readUInt16LE(end + 10);
  let at = z.readUInt32LE(end + 16);
  const out: { name: string; data: Buffer; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (z.readUInt32LE(at) !== 0x02014b50) throw new Error("Not a central directory entry");
    const size = z.readUInt32LE(at + 20);
    const nameLength = z.readUInt16LE(at + 28);
    const local = z.readUInt32LE(at + 42);
    const name = z.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    const dataAt = local + 30 + z.readUInt16LE(local + 26) + z.readUInt16LE(local + 28);
    out.push({ name, data: inflateRawSync(z.subarray(dataAt, dataAt + size)), crc: z.readUInt32LE(at + 16) });
    at += 46 + nameLength;
  }
  return out;
}
