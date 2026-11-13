function encodeSynchsafe32(num: number): [number, number, number, number] {
  return [
    (num >> 21) & 0x7f,
    (num >> 14) & 0x7f,
    (num >> 7) & 0x7f,
    num & 0x7f,
  ];
}

function encodeUint32BE(num: number): [number, number, number, number] {
  return [
    (num >> 24) & 0xff,
    (num >> 16) & 0xff,
    (num >> 8) & 0xff,
    num & 0xff,
  ];
}

function buildTextFrame(frameId: string, value: string): Uint8Array {
  const payloadText = new TextEncoder().encode(value);
  // UTF-8 encoding flag = 0x03 in ID3v2.4, or UTF-16 BOM (0x01) / ISO-8859-1 (0x00) in v2.3.
  // Using ID3v2.4 with 0x03 UTF-8 gives universal Unicode compatibility with synchsafe frame sizes.
  const bodySize = 1 + payloadText.length;
  const frame = new Uint8Array(10 + bodySize);
  for (let i = 0; i < 4; i++) {
    frame[i] = frameId.charCodeAt(i);
  }
  const sizeBytes = encodeSynchsafe32(bodySize);
  frame[4] = sizeBytes[0];
  frame[5] = sizeBytes[1];
  frame[6] = sizeBytes[2];
  frame[7] = sizeBytes[3];
  frame[8] = 0;
  frame[9] = 0;
  frame[10] = 0x03; // UTF-8
  frame.set(payloadText, 11);
  return frame;
}

export function buildId3v2Header(meta: {
  title?: string;
  artist?: string;
  album?: string;
}): Uint8Array {
  const frames: Uint8Array[] = [];
  if (meta.title?.trim()) frames.push(buildTextFrame('TIT2', meta.title.trim()));
  if (meta.artist?.trim()) frames.push(buildTextFrame('TPE1', meta.artist.trim()));
  if (meta.album?.trim()) frames.push(buildTextFrame('TALB', meta.album.trim()));

  const framesLen = frames.reduce((acc, f) => acc + f.length, 0);
  const out = new Uint8Array(10 + framesLen);
  // ID3v2.4 header
  out[0] = 0x49; // I
  out[1] = 0x44; // D
  out[2] = 0x33; // 3
  out[3] = 0x04; // v2.4
  out[4] = 0x00;
  out[5] = 0x00;
  const tagSize = encodeSynchsafe32(framesLen);
  out[6] = tagSize[0];
  out[7] = tagSize[1];
  out[8] = tagSize[2];
  out[9] = tagSize[3];

  let offset = 10;
  for (const f of frames) {
    out.set(f, offset);
    offset += f.length;
  }
  return out;
}

export function stripExistingId3v2(mp3Bytes: Uint8Array): Uint8Array {
  if (
    mp3Bytes.length >= 10 &&
    mp3Bytes[0] === 0x49 &&
    mp3Bytes[1] === 0x44 &&
    mp3Bytes[2] === 0x33
  ) {
    const size =
      ((mp3Bytes[6] & 0x7f) << 21) |
      ((mp3Bytes[7] & 0x7f) << 14) |
      ((mp3Bytes[8] & 0x7f) << 7) |
      (mp3Bytes[9] & 0x7f);
    const totalSkip = 10 + size;
    if (totalSkip < mp3Bytes.length) {
      return mp3Bytes.subarray(totalSkip);
    }
  }
  return mp3Bytes;
}

export function applyId3v2Metadata(
  mp3Bytes: Uint8Array,
  meta: { title?: string; artist?: string; album?: string }
): Uint8Array {
  const audioBody = stripExistingId3v2(mp3Bytes);
  const header = buildId3v2Header(meta);
  const combined = new Uint8Array(header.length + audioBody.length);
  combined.set(header, 0);
  combined.set(audioBody, header.length);
  return combined;
}

export function encodeWavBufferWithMeta(
  channels: Float32Array[],
  sampleRate: number
): Uint8Array {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const out = new Uint8Array(44 + dataSize);
  const view = new DataView(out.buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return out;
}

export { encodeUint32BE };
