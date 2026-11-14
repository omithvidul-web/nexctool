import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAdtsAudioFromMp4OrMov, maskNonAudioTracksInMp4Mov } from './mp4AudioExtractor';

function box(type: string, ...payloads: Uint8Array[]): Uint8Array {
  const totalPayload = payloads.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(8 + totalPayload);
  const view = new DataView(out.buffer);
  view.setUint32(0, out.byteLength, false);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  let offset = 8;
  for (const p of payloads) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function buildSyntheticHevcMovWithAac(): ArrayBuffer {
  // ftyp with QuickTime 'qt  ' major brand
  const ftyp = box('ftyp', new TextEncoder().encode('qt  \x00\x00\x02\x00qt  '));

  // 2 fake AAC access units inside mdat (starts at offset ftyp.byteLength + 8)
  const aacFrame1 = new Uint8Array([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]);
  const aacFrame2 = new Uint8Array([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1d]);
  const mdat = box('mdat', aacFrame1, aacFrame2);
  const mdatPayloadOffset = ftyp.byteLength + 8;

  // Track 1: HEVC video ('vide' + 'hvc1')
  const videHdlrPayload = new Uint8Array(24);
  videHdlrPayload.set(new TextEncoder().encode('vide'), 8);
  const videTrak = box('trak', box('mdia', box('hdlr', videHdlrPayload)));

  // Track 2: AAC audio ('soun' + 'mp4a' with esds AudioSpecificConfig for 44.1kHz stereo AAC-LC)
  const sounHdlrPayload = new Uint8Array(24);
  sounHdlrPayload.set(new TextEncoder().encode('soun'), 8);

  // esds: version(4) + tag 0x03 + tag 0x04 (len 18, 0x40, 0x15, 11 zero bytes) + tag 0x05 (len 2, 0x12, 0x10 = AAC-LC 44.1kHz 2ch)
  const esdsPayload = new Uint8Array([
    0, 0, 0, 0,
    0x03, 23, 0x00, 0x01, 0x00,
    0x04, 18, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0x05, 2, 0x12, 0x10,
  ]);
  const esds = box('esds', esdsPayload);

  const mp4aHeader = new Uint8Array(28);
  const mp4aView = new DataView(mp4aHeader.buffer);
  mp4aView.setUint16(16, 2, false); // channels = 2
  mp4aView.setUint16(24, 44100, false); // sampleRate = 44100
  const mp4aEntry = box('mp4a', mp4aHeader, esds);

  const stsd = box('stsd', u32be(0), u32be(1), mp4aEntry);
  const stsz = box('stsz', u32be(0), u32be(0), u32be(2), u32be(aacFrame1.byteLength), u32be(aacFrame2.byteLength));
  const stsc = box('stsc', u32be(0), u32be(1), u32be(1), u32be(2), u32be(1));
  const stco = box('stco', u32be(0), u32be(1), u32be(mdatPayloadOffset));

  const sounTrak = box(
    'trak',
    box('mdia', box('hdlr', sounHdlrPayload), box('minf', box('stbl', stsd, stsz, stsc, stco)))
  );

  const moov = box('moov', videTrak, sounTrak);
  const total = new Uint8Array(ftyp.byteLength + mdat.byteLength + moov.byteLength);
  total.set(ftyp, 0);
  total.set(mdat, ftyp.byteLength);
  total.set(moov, ftyp.byteLength + mdat.byteLength);
  return total.buffer;
}

test('extractAdtsAudioFromMp4OrMov demuxes raw AAC frames with valid 7-byte ADTS headers from HEVC MOV', () => {
  const movBuffer = buildSyntheticHevcMovWithAac();
  const adts = extractAdtsAudioFromMp4OrMov(movBuffer);
  assert.ok(adts, 'Expected non-null ADTS buffer');
  assert.equal(adts.byteLength, (7 + 6) * 2, 'Expected two 6-byte AAC frames each wrapped with 7-byte ADTS header');

  const bytes = new Uint8Array(adts);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xf1);
  // Second frame also starts with ADTS syncword at offset 13
  assert.equal(bytes[13], 0xff);
  assert.equal(bytes[14], 0xf1);
});

test('maskNonAudioTracksInMp4Mov masks HEVC vide trak to free and normalizes qt ftyp brand to M4A', () => {
  const movBuffer = buildSyntheticHevcMovWithAac();
  const masked = maskNonAudioTracksInMp4Mov(movBuffer);
  assert.ok(masked, 'Expected non-null masked buffer');
  assert.equal(masked.byteLength, movBuffer.byteLength);

  const bytes = new Uint8Array(masked);
  const ftypBrand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  assert.equal(ftypBrand, 'M4A ');
});
