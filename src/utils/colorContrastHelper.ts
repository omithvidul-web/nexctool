export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface SwatchItem {
  hex: string;
  rgb: RgbColor;
  hslString: string;
  percent: number;
}

export interface WcagContrastReport {
  ratio: number;
  ratioFormatted: string;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export function normalizeHex(input: string): string | null {
  const clean = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toUpperCase()}`;
  }
  return null;
}

export function hexToRgb(hex: string): RgbColor | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function rgbToHslString({ r, g, b }: RgbColor): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function relativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function computeWcagContrast(fgHex: string, bgHex: string): WcagContrastReport | null {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio,
    ratioFormatted: `${ratio.toFixed(2)}:1`,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3.0,
    aaaNormal: ratio >= 7.0,
    aaaLarge: ratio >= 4.5,
  };
}

export function extractPaletteFromRgba(
  rgba: Uint8ClampedArray,
  maxColors = 6
): SwatchItem[] {
  const buckets = new Map<number, { rSum: number; gSum: number; bSum: number; count: number }>();
  const pixelCount = Math.floor(rgba.length / 4);
  const stride = Math.max(1, Math.floor(pixelCount / 15000));
  let sampled = 0;

  for (let p = 0; p < pixelCount; p += stride) {
    const idx = p * 4;
    const a = rgba[idx + 3];
    if (a < 128) continue;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];

    // 4-bit per channel quantization (4096 bins)
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const prev = buckets.get(key);
    if (prev) {
      prev.rSum += r;
      prev.gSum += g;
      prev.bSum += b;
      prev.count += 1;
    } else {
      buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
    }
    sampled++;
  }

  if (sampled === 0) return [];

  const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const picked: Array<{ rgb: RgbColor; count: number }> = [];

  for (const bucket of sorted) {
    const rgb: RgbColor = {
      r: Math.round(bucket.rSum / bucket.count),
      g: Math.round(bucket.gSum / bucket.count),
      b: Math.round(bucket.bSum / bucket.count),
    };
    const tooClose = picked.some((p) => {
      const dr = p.rgb.r - rgb.r;
      const dg = p.rgb.g - rgb.g;
      const db = p.rgb.b - rgb.b;
      return dr * dr + dg * dg + db * db < 1800;
    });
    if (!tooClose) {
      picked.push({ rgb, count: bucket.count });
      if (picked.length >= maxColors) break;
    }
  }

  // Fill remaining slots if image has very few unique shades
  if (picked.length < maxColors) {
    for (const bucket of sorted) {
      const rgb: RgbColor = {
        r: Math.round(bucket.rSum / bucket.count),
        g: Math.round(bucket.gSum / bucket.count),
        b: Math.round(bucket.bSum / bucket.count),
      };
      const hex = rgbToHex(rgb);
      if (!picked.some((p) => rgbToHex(p.rgb) === hex)) {
        picked.push({ rgb, count: bucket.count });
        if (picked.length >= maxColors) break;
      }
    }
  }

  return picked.map((item) => ({
    hex: rgbToHex(item.rgb),
    rgb: item.rgb,
    hslString: rgbToHslString(item.rgb),
    percent: Math.max(1, Math.round((item.count / sampled) * 100)),
  }));
}
