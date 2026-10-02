// The export's ZIP and CSV writers (P6-10): every entry reads back as written, with the checksum unzip tools check.
import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { unzip } from "../test/unzip.js";
import { crc32, csv, zip } from "./archive.js";

describe("the export's archive", () => {
  it("keeps every file as written, with names in any language", () => {
    const files = [
      { name: "clients.csv", data: csv([{ code: "KVR", name: "Kaveri Organics" }]) },
      { name: "குறிப்பு.txt", data: "வணக்கம் — hello" },
      { name: "data.json", data: Buffer.from(JSON.stringify({ a: 1 })) },
    ];
    const back = unzip(zip(files));
    expect(back.map((f) => [f.name, f.data.toString("utf8")])).toEqual(files.map((f) => [f.name, f.data.toString()]));
    for (const f of back) expect(f.crc).toBe(nodeCrc32(f.data));
  });

  it("checksums like zlib", () => {
    const data = Buffer.from("The quick brown fox jumps over the lazy dog");
    expect(crc32(data)).toBe(0x414fa339);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it("writes CSV with quotes only where needed, dates as ISO and structured values as JSON", () => {
    expect(
      csv([
        { id: 1, note: 'He said "yes", then left', at: new Date("2026-10-03T04:00:00Z"), data: { a: [1, 2] }, size: 10n, empty: null },
        { id: 2, note: "two\nlines", at: null, data: null, size: 0n, empty: undefined },
      ]),
    ).toBe('id,note,at,data,size,empty\r\n1,"He said ""yes"", then left",2026-10-03T04:00:00.000Z,"{""a"":[1,2]}",10,\r\n2,"two\nlines",,,0,\r\n');
  });
});
