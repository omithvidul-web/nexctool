/**
 * Applies slice + smooth fade-in / fade-out gain envelope to multi-channel PCM samples.
 * Works purely on Float32Arrays so it can be unit-tested in Node without DOM AudioBuffer.
 */
export function sliceAndFadeChannels(
  channels: Float32Array[],
  sampleRate: number,
  startSec: number,
  endSec: number,
  fadeInSec: number,
  fadeOutSec: number,
  gainMultiplier = 1
): Float32Array[] {
  if (channels.length === 0 || sampleRate <= 0) return [];
  const totalSamples = channels[0].length;
  const startSample = Math.max(0, Math.min(totalSamples - 1, Math.floor(startSec * sampleRate)));
  const endSample = Math.max(startSample + 1, Math.min(totalSamples, Math.ceil(endSec * sampleRate)));
  const outLength = Math.max(1, endSample - startSample);

  const fadeInSamples = Math.min(
    Math.floor(outLength / 2),
    Math.max(0, Math.round(fadeInSec * sampleRate))
  );
  const fadeOutSamples = Math.min(
    outLength - fadeInSamples,
    Math.max(0, Math.round(fadeOutSec * sampleRate))
  );

  return channels.map((src) => {
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      let env = gainMultiplier;
      if (fadeInSamples > 0 && i < fadeInSamples) {
        env *= i / fadeInSamples;
      }
      const distFromEnd = outLength - 1 - i;
      if (fadeOutSamples > 0 && distFromEnd < fadeOutSamples) {
        env *= distFromEnd / fadeOutSamples;
      }
      const sample = src[startSample + i] * env;
      out[i] = Math.max(-1, Math.min(1, sample));
    }
    return out;
  });
}

export async function encodeChannelsToMp3(
  channels: Float32Array[],
  sampleRate: number,
  kbps = 192
): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const chCount = Math.min(2, Math.max(1, channels.length));
  const encoder = new Mp3Encoder(chCount, sampleRate, kbps);

  const toInt16 = (f32: Float32Array): Int16Array => {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return out;
  };

  const left = toInt16(channels[0]);
  const right = chCount > 1 ? toInt16(channels[1]) : undefined;

  const parts: Uint8Array[] = [];
  const block = 1152;
  for (let i = 0; i < left.length; i += block) {
    const encoded = encoder.encodeBuffer(
      left.subarray(i, i + block),
      right ? right.subarray(i, i + block) : undefined
    );
    if (encoded.length > 0) parts.push(new Uint8Array(encoded));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(new Uint8Array(tail));

  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

export function computeSocialVideoDrawRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  fit: 'contain' | 'cover'
): { dx: number; dy: number; dw: number; dh: number } {
  const safeSrcW = Math.max(1, srcW);
  const safeSrcH = Math.max(1, srcH);
  const scale =
    fit === 'cover'
      ? Math.max(dstW / safeSrcW, dstH / safeSrcH)
      : Math.min(dstW / safeSrcW, dstH / safeSrcH);
  const dw = safeSrcW * scale;
  const dh = safeSrcH * scale;
  return {
    dx: (dstW - dw) / 2,
    dy: (dstH - dh) / 2,
    dw,
    dh,
  };
}
