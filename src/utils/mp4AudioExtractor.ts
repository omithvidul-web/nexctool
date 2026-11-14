/**
 * Pure-TypeScript ISO-BMFF (.mp4 / .mov / .m4v) audio extractor & container sanitizer.
 *
 * Why this exists:
 * On iOS Safari (WebKit) and mobile browsers, passing an HEVC (hvc1 / hev1 / dvh1)
 * or QuickTime (.mov) video container directly to `AudioContext.decodeAudioData()` fails
 * with `EncodingError: Decoding failed` because the browser's audio file parser rejects
 * containers containing HEVC video tracks, QuickTime `qt  ` brands, or multi-track metadata
 * (`meta`, `tmcd`, `apac`).
 *
 * This module provides:
 * 1. `extractAdtsAudioFromMp4OrMov`: Demuxes raw AAC (`mp4a`) frames from `moov -> trak (soun)`
 *    and wraps each frame in a 7-byte ADTS header to produce a pure, tiny `.aac` stream.
 * 2. `maskNonAudioTracksInMp4Mov`: Produces a sanitized ISO-BMFF copy where non-audio `trak`
 *    boxes (`vide` HEVC, `meta`, `tmcd`, `apac`) are converted in-place into `'free'` padding
 *    boxes (preserving all byte offsets in `stco`/`co64`) and QuickTime `ftyp` is normalized to `M4A `.
 */

interface BoxRef {
  type: string;
  start: number;
  headerSize: number;
  payloadStart: number;
  end: number;
}

const ADTS_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && offset + i < bytes.length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

function writeAscii4(bytes: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < 4; i++) {
    bytes[offset + i] = str.charCodeAt(i) & 0xff;
  }
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function readU64(view: DataView, offset: number): number {
  const hi = view.getUint32(offset, false);
  const lo = view.getUint32(offset + 4, false);
  return hi * 4294967296 + lo;
}

function listBoxes(bytes: Uint8Array, view: DataView, start: number, end: number): BoxRef[] {
  const boxes: BoxRef[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    const rawSize = readU32(view, pos);
    const type = readAscii(bytes, pos + 4, 4);
    let headerSize = 8;
    let boxEnd = pos + rawSize;

    if (rawSize === 1) {
      if (pos + 16 > end) break;
      const largeSize = readU64(view, pos + 8);
      headerSize = 16;
      boxEnd = pos + largeSize;
    } else if (rawSize === 0) {
      boxEnd = end;
    }

    if (boxEnd <= pos + headerSize - 1 || boxEnd > end) {
      break;
    }

    boxes.push({
      type,
      start: pos,
      headerSize,
      payloadStart: pos + headerSize,
      end: boxEnd,
    });

    pos = boxEnd;
  }
  return boxes;
}

function findChildBox(bytes: Uint8Array, view: DataView, parent: BoxRef, type: string): BoxRef | null {
  const children = listBoxes(bytes, view, parent.payloadStart, parent.end);
  return children.find((b) => b.type === type) ?? null;
}

function findSampleRateIndex(sampleRate: number): number {
  let bestIdx = 4; // 44100 default
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ADTS_SAMPLE_RATES.length; i++) {
    const diff = Math.abs(ADTS_SAMPLE_RATES[i] - sampleRate);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function readDescriptorLength(bytes: Uint8Array, pos: number, end: number): { length: number; nextPos: number } {
  let len = 0;
  let q = pos;
  for (let k = 0; k < 4 && q < end; k++) {
    const b = bytes[q++];
    len = (len << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return { length: len, nextPos: q };
}

/**
 * Scans inside an `mp4a` SampleEntry payload for an `esds` box (either directly
 * or nested inside QuickTime's `wave` atom) and parses the ISO 14496-1
 * DecoderConfigDescriptor (0x04) -> DecoderSpecificInfo (0x05) AudioSpecificConfig.
 */
function parseEsdsAudioConfig(
  bytes: Uint8Array,
  start: number,
  end: number
): { profileObjType: number; freqIdx: number; chanCfg: number } | null {
  for (let i = start; i + 8 < end; i++) {
    if (
      bytes[i] === 0x65 && // 'e'
      bytes[i + 1] === 0x73 && // 's'
      bytes[i + 2] === 0x64 && // 'd'
      bytes[i + 3] === 0x73 // 's'
    ) {
      const boxStart = i - 4;
      if (boxStart < start) continue;
      const boxSize =
        ((bytes[boxStart] << 24) >>> 0) |
        (bytes[boxStart + 1] << 16) |
        (bytes[boxStart + 2] << 8) |
        bytes[boxStart + 3];
      const boxEnd = Math.min(end, boxStart + (boxSize >= 8 ? boxSize : end - boxStart));

      // Locate DecoderConfigDescriptor (tag 0x04) followed by audio objectTypeIndication (0x40 or 0x66..0x68)
      // and streamType 0x15 ((5 << 2) | 1 = AudioStream)
      for (let p = i + 8; p + 16 < boxEnd; p++) {
        if (bytes[p] !== 0x04) continue;
        const dcd = readDescriptorLength(bytes, p + 1, boxEnd);
        if (dcd.length < 13 || dcd.nextPos + 13 > boxEnd) continue;

        const objTypeInd = bytes[dcd.nextPos];
        const streamTypeByte = bytes[dcd.nextPos + 1];
        const isAudio =
          (objTypeInd === 0x40 || objTypeInd === 0x66 || objTypeInd === 0x67 || objTypeInd === 0x68) &&
          (streamTypeByte >> 2) === 0x05;
        if (!isAudio) continue;

        // DecoderSpecificInfo (tag 0x05) immediately follows the 13-byte DecoderConfigDescriptor header
        const dsiPos = dcd.nextPos + 13;
        if (dsiPos + 3 <= boxEnd && bytes[dsiPos] === 0x05) {
          const dsi = readDescriptorLength(bytes, dsiPos + 1, boxEnd);
          if (dsi.length >= 2 && dsi.nextPos + 2 <= boxEnd) {
            const b0 = bytes[dsi.nextPos];
            const b1 = bytes[dsi.nextPos + 1];
            let audioObjectType = (b0 >> 3) & 0x1f;
            let freqIdx = ((b0 & 0x07) << 1) | ((b1 >> 7) & 0x01);
            let chanCfg = (b1 >> 3) & 0x0f;

            if (freqIdx === 0x0f && dsi.nextPos + 5 <= boxEnd) {
              // 24-bit explicit sampling frequency in AudioSpecificConfig
              const explicitRate =
                (((b1 & 0x7f) << 17) |
                  (bytes[dsi.nextPos + 2] << 9) |
                  (bytes[dsi.nextPos + 3] << 1) |
                  (bytes[dsi.nextPos + 4] >> 7)) >>>
                0;
              freqIdx = findSampleRateIndex(explicitRate);
              chanCfg = (bytes[dsi.nextPos + 4] >> 3) & 0x0f;
            }

            if (audioObjectType === 5 || audioObjectType === 29 || audioObjectType < 1 || audioObjectType > 4) {
              audioObjectType = 2; // AAC-LC base layer for ADTS
            }
            if (freqIdx >= 0 && freqIdx < 13 && chanCfg >= 1 && chanCfg <= 7) {
              return { profileObjType: audioObjectType, freqIdx, chanCfg };
            }
          }
        }
      }
    }
  }
  return null;
}

interface StblSampleRange {
  offset: number;
  size: number;
}

function buildSampleRanges(bytes: Uint8Array, view: DataView, stbl: BoxRef): StblSampleRange[] | null {
  const stsz = findChildBox(bytes, view, stbl, 'stsz');
  const stsc = findChildBox(bytes, view, stbl, 'stsc');
  const stco = findChildBox(bytes, view, stbl, 'stco');
  const co64 = findChildBox(bytes, view, stbl, 'co64');

  if (!stsz || !stsc || (!stco && !co64)) return null;

  // 1. Parse sample sizes from stsz
  if (stsz.payloadStart + 12 > stsz.end) return null;
  const fixedSampleSize = readU32(view, stsz.payloadStart + 4);
  const sampleCount = readU32(view, stsz.payloadStart + 8);
  if (sampleCount === 0 || sampleCount > 2_000_000) return null;

  const sampleSizes = new Uint32Array(sampleCount);
  if (fixedSampleSize > 0) {
    sampleSizes.fill(fixedSampleSize);
  } else {
    if (stsz.payloadStart + 12 + sampleCount * 4 > stsz.end) return null;
    for (let i = 0; i < sampleCount; i++) {
      sampleSizes[i] = readU32(view, stsz.payloadStart + 12 + i * 4);
    }
  }

  // 2. Parse chunk offsets from stco or co64
  const chunkOffsets: number[] = [];
  if (stco) {
    if (stco.payloadStart + 8 > stco.end) return null;
    const chunkCount = readU32(view, stco.payloadStart + 4);
    if (stco.payloadStart + 8 + chunkCount * 4 > stco.end) return null;
    for (let c = 0; c < chunkCount; c++) {
      chunkOffsets.push(readU32(view, stco.payloadStart + 8 + c * 4));
    }
  } else if (co64) {
    if (co64.payloadStart + 8 > co64.end) return null;
    const chunkCount = readU32(view, co64.payloadStart + 4);
    if (co64.payloadStart + 8 + chunkCount * 8 > co64.end) return null;
    for (let c = 0; c < chunkCount; c++) {
      chunkOffsets.push(readU64(view, co64.payloadStart + 8 + c * 8));
    }
  }
  if (chunkOffsets.length === 0) return null;

  // 3. Parse sample-to-chunk table from stsc
  if (stsc.payloadStart + 8 > stsc.end) return null;
  const stscCount = readU32(view, stsc.payloadStart + 4);
  if (stscCount === 0 || stsc.payloadStart + 8 + stscCount * 12 > stsc.end) return null;

  const stscEntries: Array<{ firstChunk1Based: number; samplesPerChunk: number }> = [];
  for (let i = 0; i < stscCount; i++) {
    const base = stsc.payloadStart + 8 + i * 12;
    stscEntries.push({
      firstChunk1Based: readU32(view, base),
      samplesPerChunk: readU32(view, base + 4),
    });
  }

  // 4. Expand chunks -> individual sample (offset, size)
  const ranges: StblSampleRange[] = [];
  let sampleIdx = 0;

  for (let chunkIdx0 = 0; chunkIdx0 < chunkOffsets.length && sampleIdx < sampleCount; chunkIdx0++) {
    const chunkNum1 = chunkIdx0 + 1;
    let samplesInThisChunk = stscEntries[0].samplesPerChunk;
    for (let e = 0; e < stscEntries.length; e++) {
      if (chunkNum1 >= stscEntries[e].firstChunk1Based) {
        samplesInThisChunk = stscEntries[e].samplesPerChunk;
      } else {
        break;
      }
    }

    let curOffset = chunkOffsets[chunkIdx0];
    for (let s = 0; s < samplesInThisChunk && sampleIdx < sampleCount; s++) {
      const sz = sampleSizes[sampleIdx++];
      if (sz > 0 && curOffset >= 0 && curOffset + sz <= bytes.length) {
        ranges.push({ offset: curOffset, size: sz });
      }
      curOffset += sz;
    }
  }

  return ranges.length > 0 ? ranges : null;
}

/**
 * Extracts the primary AAC (`mp4a`) audio track from an MP4 or QuickTime `.mov`
 * container as a standalone ADTS `.aac` ArrayBuffer.
 * Returns `null` if the file is not an ISO-BMFF container or has no AAC track.
 */
export function extractAdtsAudioFromMp4OrMov(buffer: ArrayBuffer): ArrayBuffer | null {
  if (buffer.byteLength < 32) return null;
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const topBoxes = listBoxes(bytes, view, 0, bytes.length);
  const moov = topBoxes.find((b) => b.type === 'moov');
  if (!moov) return null;

  const moovChildren = listBoxes(bytes, view, moov.payloadStart, moov.end);
  const traks = moovChildren.filter((b) => b.type === 'trak');

  for (const trak of traks) {
    const mdia = findChildBox(bytes, view, trak, 'mdia');
    if (!mdia) continue;

    const hdlr = findChildBox(bytes, view, mdia, 'hdlr');
    if (!hdlr || hdlr.payloadStart + 12 > hdlr.end) continue;
    const handlerType = readAscii(bytes, hdlr.payloadStart + 8, 4);
    if (handlerType !== 'soun') continue;

    const minf = findChildBox(bytes, view, mdia, 'minf');
    if (!minf) continue;
    const stbl = findChildBox(bytes, view, minf, 'stbl');
    if (!stbl) continue;

    const stsd = findChildBox(bytes, view, stbl, 'stsd');
    if (!stsd || stsd.payloadStart + 16 > stsd.end) continue;

    const entryStart = stsd.payloadStart + 8;
    const entrySize = readU32(view, entryStart);
    const entryFormat = readAscii(bytes, entryStart + 4, 4);
    const entryEnd = Math.min(stsd.end, entryStart + Math.max(16, entrySize));

    if (entryFormat !== 'mp4a') {
      continue;
    }

    // Parse default channel count & sample rate from AudioSampleEntry header
    let channels = 2;
    let sampleRate = 44100;
    if (entryStart + 36 <= entryEnd) {
      const qtVersion = readU16(view, entryStart + 16);
      if (qtVersion === 2 && entryStart + 56 <= entryEnd) {
        sampleRate = Math.round(view.getFloat64(entryStart + 40, false)) || 44100;
        channels = readU32(view, entryStart + 48) || 2;
      } else {
        channels = readU16(view, entryStart + 24) || 2;
        sampleRate = readU16(view, entryStart + 32) || 44100;
      }
    }

    // Prefer exact AudioSpecificConfig from esds atom if present
    const esdsCfg = parseEsdsAudioConfig(bytes, entryStart + 16, entryEnd);
    const profileObjType = esdsCfg ? esdsCfg.profileObjType : 2; // 2 = AAC-LC
    const freqIdx = esdsCfg ? esdsCfg.freqIdx : findSampleRateIndex(sampleRate);
    const chanCfg = esdsCfg ? esdsCfg.chanCfg : Math.min(7, Math.max(1, channels));

    const ranges = buildSampleRanges(bytes, view, stbl);
    if (!ranges || ranges.length === 0) continue;

    let totalAdtsBytes = 0;
    for (const r of ranges) {
      if (r.size > 0 && r.size + 7 <= 8191) {
        totalAdtsBytes += r.size + 7;
      }
    }
    if (totalAdtsBytes === 0) continue;

    const out = new Uint8Array(totalAdtsBytes);
    const profile = (profileObjType - 1) & 0x03;
    let writePos = 0;

    for (const r of ranges) {
      const frameLen = r.size + 7;
      if (r.size <= 0 || frameLen > 8191) continue;

      // 7-byte ADTS header (ISO/IEC 13818-7 / MPEG-4 ADTS)
      out[writePos] = 0xff;
      out[writePos + 1] = 0xf1; // MPEG-4, Layer 0, protection_absent = 1
      out[writePos + 2] =
        ((profile & 0x03) << 6) | ((freqIdx & 0x0f) << 2) | ((chanCfg >> 2) & 0x01);
      out[writePos + 3] = ((chanCfg & 0x03) << 6) | ((frameLen >> 11) & 0x03);
      out[writePos + 4] = (frameLen >> 3) & 0xff;
      out[writePos + 5] = ((frameLen & 0x07) << 5) | 0x1f;
      out[writePos + 6] = 0xfc;

      out.set(bytes.subarray(r.offset, r.offset + r.size), writePos + 7);
      writePos += frameLen;
    }

    return out.buffer;
  }

  return null;
}

/**
 * Creates a cloned ArrayBuffer where all non-audio `trak` boxes inside `moov`
 * (such as `vide` HEVC/hvc1, `meta`, `tmcd`, or Apple `apac` Spatial Audio when a fallback
 * track exists) have their 4-byte box type overwritten in-place with `'free'`,
 * and `ftyp` major brand `'qt  '` is patched to `'M4A '`.
 *
 * Because this is an in-place 4-byte tag replacement, all `stco`/`co64` chunk offsets
 * pointing into `mdat` remain 100% valid while the video track is completely hidden from
 * `AudioContext.decodeAudioData()`.
 */
export function maskNonAudioTracksInMp4Mov(buffer: ArrayBuffer): ArrayBuffer | null {
  if (buffer.byteLength < 32) return null;
  const srcBytes = new Uint8Array(buffer);
  const srcView = new DataView(buffer);

  const topBoxes = listBoxes(srcBytes, srcView, 0, srcBytes.length);
  const moov = topBoxes.find((b) => b.type === 'moov');
  if (!moov) return null;

  const moovChildren = listBoxes(srcBytes, srcView, moov.payloadStart, moov.end);
  const traks = moovChildren.filter((b) => b.type === 'trak');
  if (traks.length === 0) return null;

  const trackInfos: Array<{ trak: BoxRef; handlerType: string; format: string }> = [];
  for (const trak of traks) {
    const mdia = findChildBox(srcBytes, srcView, trak, 'mdia');
    const hdlr = mdia ? findChildBox(srcBytes, srcView, mdia, 'hdlr') : null;
    const handlerType =
      hdlr && hdlr.payloadStart + 12 <= hdlr.end
        ? readAscii(srcBytes, hdlr.payloadStart + 8, 4)
        : '';

    let format = '';
    if (mdia) {
      const minf = findChildBox(srcBytes, srcView, mdia, 'minf');
      const stbl = minf ? findChildBox(srcBytes, srcView, minf, 'stbl') : null;
      const stsd = stbl ? findChildBox(srcBytes, srcView, stbl, 'stsd') : null;
      if (stsd && stsd.payloadStart + 16 <= stsd.end) {
        format = readAscii(srcBytes, stsd.payloadStart + 12, 4);
      }
    }
    trackInfos.push({ trak, handlerType, format });
  }

  const sounTracks = trackInfos.filter((t) => t.handlerType === 'soun');
  if (sounTracks.length === 0) return null;

  // Prefer keeping 'mp4a' or standard PCM if multiple 'soun' tracks exist (e.g. 'apac' + 'mp4a')
  const preferredSoun =
    sounTracks.find((t) => t.format === 'mp4a') ??
    sounTracks.find((t) => t.format !== 'apac') ??
    sounTracks[0];

  const copy = buffer.slice(0);
  const outBytes = new Uint8Array(copy);

  // Normalize QuickTime 'qt  ' ftyp brand to 'M4A ' so WebKit AudioFileStream treats it as audio
  const ftyp = topBoxes.find((b) => b.type === 'ftyp');
  if (ftyp && ftyp.payloadStart + 4 <= ftyp.end) {
    const majorBrand = readAscii(outBytes, ftyp.payloadStart, 4);
    if (majorBrand === 'qt  ') {
      writeAscii4(outBytes, ftyp.payloadStart, 'M4A ');
    }
  }

  let maskedAny = false;
  for (const info of trackInfos) {
    if (info.trak !== preferredSoun.trak) {
      writeAscii4(outBytes, info.trak.start + 4, 'free');
      maskedAny = true;
    }
  }

  return maskedAny ? copy : null;
}
