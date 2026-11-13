// Pure TypeScript GIF89a animated GIF encoder (6-6-6 RGB web-safe palette + LZW compression)
// and clean row-run PNG-to-SVG path vectorizer.

function build216Palette(): { palette: Uint8Array; mapRgb: (r: number, g: number, b: number) => number } {
  const palette = new Uint8Array(256 * 3);
  let idx = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx++] = Math.round((r * 255) / 5);
        palette[idx++] = Math.round((g * 255) / 5);
        palette[idx++] = Math.round((b * 255) / 5);
      }
    }
  }
  const mapRgb = (r: number, g: number, b: number) => {
    const ri = Math.round((r * 5) / 255);
    const gi = Math.round((g * 5) / 255);
    const bi = Math.round((b * 5) / 255);
    return ri * 36 + gi * 6 + bi;
  };
  return { palette, mapRgb };
}

function lzwEncode(indices: Uint8Array, minCodeSize = 8): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const output: number[] = [];

  let curBits = 0;
  let curAccum = 0;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<string, number>();

  const resetDict = () => {
    dict = new Map<string, number>();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  const emit = (code: number) => {
    curAccum |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      output.push(curAccum & 0xff);
      curAccum >>= 8;
      curBits -= 8;
    }
  };

  emit(clearCode);
  let prefix = String(indices[0] ?? 0);

  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const combined = `${prefix},${c}`;
    if (dict.has(combined)) {
      prefix = combined;
    } else {
      const outCode = prefix.includes(',') ? dict.get(prefix)! : Number(prefix);
      emit(outCode);
      if (nextCode < 4096) {
        dict.set(combined, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      } else {
        emit(clearCode);
        resetDict();
      }
      prefix = String(c);
    }
  }

  emit(prefix.includes(',') ? dict.get(prefix)! : Number(prefix));
  emit(eoiCode);
  if (curBits > 0) output.push(curAccum & 0xff);

  // Split into GIF sub-blocks (max 255 bytes each)
  const subBlocks: number[] = [minCodeSize];
  for (let i = 0; i < output.length; i += 255) {
    const slice = output.slice(i, i + 255);
    subBlocks.push(slice.length, ...slice);
  }
  subBlocks.push(0); // block terminator
  return new Uint8Array(subBlocks);
}

export function encodeAnimatedGif(
  frames: { rgba: Uint8ClampedArray; delayCs: number }[],
  width: number,
  height: number
): Uint8Array {
  const { palette, mapRgb } = build216Palette();
  const chunks: number[] = [];

  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i++) chunks.push(s.charCodeAt(i));
  };
  const pushU16 = (v: number) => {
    chunks.push(v & 0xff, (v >> 8) & 0xff);
  };

  // Header & Logical Screen Descriptor
  pushStr('GIF89a');
  pushU16(width);
  pushU16(height);
  chunks.push(0xf7, 0, 0); // Global color table: 256 entries

  // Global Color Table (256 * 3 bytes)
  for (let i = 0; i < palette.length; i++) chunks.push(palette[i]);

  // Netscape 2.0 infinite loop extension
  chunks.push(0x21, 0xff, 0x0b);
  pushStr('NETSCAPE2.0');
  chunks.push(0x03, 0x01, 0x00, 0x00, 0x00);

  for (const frame of frames) {
    // Graphic Control Extension
    chunks.push(0x21, 0xf9, 0x04, 0x04);
    pushU16(Math.max(2, frame.delayCs));
    chunks.push(0, 0);

    // Image Descriptor
    chunks.push(0x2c);
    pushU16(0);
    pushU16(0);
    pushU16(width);
    pushU16(height);
    chunks.push(0);

    const indexed = new Uint8Array(width * height);
    for (let p = 0; p < indexed.length; p++) {
      const off = p * 4;
      indexed[p] = mapRgb(frame.rgba[off], frame.rgba[off + 1], frame.rgba[off + 2]);
    }

    const lzw = lzwEncode(indexed, 8);
    for (let i = 0; i < lzw.length; i++) chunks.push(lzw[i]);
  }

  chunks.push(0x3b); // GIF trailer
  return new Uint8Array(chunks);
}

// Quantize & run-length encode image pixels into clean SVG <path> layers by color
export function imageRgbaToSvg(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): string {
  const colorPaths = new Map<string, string[]>();

  const quantHex = (r: number, g: number, b: number) => {
    const qr = Math.min(255, Math.round(r / 16) * 16);
    const qg = Math.min(255, Math.round(g / 16) * 16);
    const qb = Math.min(255, Math.round(b / 16) * 16);
    return (
      '#' +
      qr.toString(16).padStart(2, '0') +
      qg.toString(16).padStart(2, '0') +
      qb.toString(16).padStart(2, '0')
    );
  };

  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const off = (y * width + x) * 4;
      const alpha = rgba[off + 3];
      if (alpha < 128) {
        x++;
        continue;
      }
      const hex = quantHex(rgba[off], rgba[off + 1], rgba[off + 2]);
      let runEnd = x + 1;
      while (runEnd < width) {
        const nextOff = (y * width + runEnd) * 4;
        if (rgba[nextOff + 3] < 128) break;
        if (quantHex(rgba[nextOff], rgba[nextOff + 1], rgba[nextOff + 2]) !== hex) break;
        runEnd++;
      }
      const runWidth = runEnd - x;
      const paths = colorPaths.get(hex) ?? [];
      paths.push(`M${x} ${y}h${runWidth}v1h-${runWidth}z`);
      colorPaths.set(hex, paths);
      x = runEnd;
    }
  }

  const pathElements = Array.from(colorPaths.entries())
    .map(([fill, dList]) => `  <path fill="${fill}" d="${dList.join('')}" />`)
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">\n${pathElements}\n</svg>`;
}
