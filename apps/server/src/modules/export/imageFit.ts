/**
 * Fit image into a max box without stretching (letterbox / contain).
 */
export function fitContain(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (srcW <= 0 || srcH <= 0) {
    return { width: maxW, height: maxH };
  }
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

/** Read PNG/JPEG pixel size from buffer (no deps). Returns null if unknown. */
export function readImageSize(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width > 0 && height > 0) return { width, height };
    return null;
  }
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i < buffer.length - 8) {
      if (buffer[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buffer[i + 1]!;
      if (marker === 0xd9 || marker === 0xda) break;
      const len = buffer.readUInt16BE(i + 2);
      // SOF0 / SOF2
      if (
        marker === 0xc0 ||
        marker === 0xc2 ||
        marker === 0xc1 ||
        marker === 0xc3
      ) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }
      i += 2 + len;
    }
  }
  // WEBP VP8X / VP8
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      if (width > 0 && height > 0) return { width, height };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      if (width > 0 && height > 0) return { width, height };
    }
  }
  return null;
}
