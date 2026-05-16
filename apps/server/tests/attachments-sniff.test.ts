import { describe, expect, it } from "vitest";
import { isMimeConsistent, sniffMime } from "../src/attachments.js";

/**
 * Magic-bytes sniff гарантирует что клиент-объявленный mime реально
 * соответствует содержимому файла. Без этого можно было бы загрузить .exe
 * под видом image/png. Эти тесты — fixtures с минимальными byte-prefix'ами
 * каждого формата, проверяют что:
 *   1) sniffMime() корректно классифицирует каждое family
 *   2) isMimeConsistent() пропускает валидные пары и отклоняет mismatch'и
 */

function hex(bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

describe("sniffMime", () => {
  it("classifies JPEG by FF D8 FF prefix", () => {
    const buf = Buffer.concat([hex([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("jpeg");
  });

  it("classifies PNG by 89 50 4E 47 prefix", () => {
    const buf = Buffer.concat([hex([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("png");
  });

  it("classifies GIF by GIF8 prefix", () => {
    const buf = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("gif");
  });

  it("classifies WebP via RIFF...WEBP tag", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP"),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("webp");
  });

  it("classifies WAV via RIFF...WAVE tag", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE"),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("wav");
  });

  it("classifies AVI via RIFF...AVI tag", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("AVI "),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("avi");
  });

  it("classifies HEIC by ftyp + heic brand", () => {
    const buf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftyp"),
      Buffer.from("heic"),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("heif");
  });

  it("classifies AVIF by ftyp + avif brand", () => {
    const buf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftyp"),
      Buffer.from("avif"),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("avif");
  });

  it("classifies MP4 by generic ftyp", () => {
    const buf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftyp"),
      Buffer.from("mp42"),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("mp4");
  });

  it("classifies PDF by %PDF magic", () => {
    const buf = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("pdf");
  });

  it("classifies ZIP / docx / xlsx by PK\\x03\\x04 prefix", () => {
    const buf = Buffer.concat([hex([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("zip");
  });

  it("classifies RAR by Rar!\\x1A\\x07 prefix", () => {
    const buf = Buffer.concat([
      Buffer.from("Rar!"),
      hex([0x1a, 0x07, 0x00]),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("rar");
  });

  it("classifies 7z by 37 7A BC AF 27 1C prefix", () => {
    const buf = Buffer.concat([
      hex([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
      Buffer.alloc(20),
    ]);
    expect(sniffMime(buf)).toBe("sevenz");
  });

  it("classifies gzip by 1F 8B prefix", () => {
    const buf = Buffer.concat([hex([0x1f, 0x8b, 0x08, 0x00]), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("gzip");
  });

  it("classifies bzip2 by BZh prefix", () => {
    const buf = Buffer.concat([Buffer.from("BZh9"), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("bzip2");
  });

  it("classifies tar by ustar at offset 257", () => {
    const buf = Buffer.alloc(512);
    buf.write("ustar", 257, "ascii");
    expect(sniffMime(buf)).toBe("tar");
  });

  it("classifies Matroska/WebM by 1A 45 DF A3 prefix", () => {
    const buf = Buffer.concat([hex([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("webm");
  });

  it("classifies Ogg by OggS prefix", () => {
    const buf = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("ogg");
  });

  it("classifies MP3 ID3v2 by ID3 prefix", () => {
    const buf = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(20)]);
    expect(sniffMime(buf)).toBe("mp3");
  });

  it("classifies plain UTF-8 text as 'text'", () => {
    const buf = Buffer.from("Hello world\nThis is markdown\n");
    expect(sniffMime(buf)).toBe("text");
  });

  it("returns 'unknown' for buffer with null bytes and no known signature", () => {
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x02]);
    expect(sniffMime(buf)).toBe("unknown");
  });

  it("returns 'unknown' for tiny buffer (<4 bytes)", () => {
    expect(sniffMime(Buffer.from([0xff]))).toBe("unknown");
    expect(sniffMime(Buffer.alloc(0))).toBe("unknown");
  });
});

describe("isMimeConsistent", () => {
  it("accepts matching jpeg/jpeg", () => {
    expect(isMimeConsistent("image/jpeg", "jpeg")).toBe(true);
  });

  it("rejects jpeg declared with png sniffed", () => {
    expect(isMimeConsistent("image/jpeg", "png")).toBe(false);
  });

  it("accepts docx claimed as zip-family content (Open XML)", () => {
    expect(
      isMimeConsistent(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "zip",
      ),
    ).toBe(true);
  });

  it("accepts xlsx as zip-family", () => {
    expect(
      isMimeConsistent(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "zip",
      ),
    ).toBe(true);
  });

  it("accepts odt as zip-family (OpenDocument is zip)", () => {
    expect(
      isMimeConsistent("application/vnd.oasis.opendocument.text", "zip"),
    ).toBe(true);
  });

  it("rejects docx with mismatching content (e.g. .exe)", () => {
    expect(
      isMimeConsistent(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "unknown",
      ),
    ).toBe(false);
  });

  it("accepts video/mp4 with mp4 sniff", () => {
    expect(isMimeConsistent("video/mp4", "mp4")).toBe(true);
  });

  it("accepts video/quicktime with mp4 sniff (mov is ISO BMFF)", () => {
    expect(isMimeConsistent("video/quicktime", "mp4")).toBe(true);
  });

  it("accepts video/x-matroska with webm sniff (MKV uses Matroska container)", () => {
    expect(isMimeConsistent("video/x-matroska", "webm")).toBe(true);
  });

  it("rejects mime not in whitelist", () => {
    expect(isMimeConsistent("application/x-msdownload", "unknown")).toBe(false);
    expect(isMimeConsistent("application/x-msdownload", "zip")).toBe(false);
  });

  it("accepts text-based json/markdown/csv with text sniff", () => {
    expect(isMimeConsistent("application/json", "text")).toBe(true);
    expect(isMimeConsistent("text/markdown", "text")).toBe(true);
    expect(isMimeConsistent("text/csv", "text")).toBe(true);
    expect(isMimeConsistent("image/svg+xml", "text")).toBe(true);
  });

  it("rejects pdf masquerading as plaintext", () => {
    // Если кто-то загружает text/plain но содержимое — pdf, sniff = "pdf",
    // text/plain whitelist разрешает только "text" → reject.
    expect(isMimeConsistent("text/plain", "pdf")).toBe(false);
  });

  it("rejects unknown sniff (defensive)", () => {
    expect(isMimeConsistent("image/jpeg", "unknown")).toBe(false);
    expect(isMimeConsistent("application/pdf", "unknown")).toBe(false);
  });
});
