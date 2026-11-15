import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMsToTimestamp,
  formatSubtitles,
  parseSubtitles,
  parseTimestampToMs,
  SAMPLE_SRT_SUBTITLE,
  shiftSubtitleCues,
} from './subtitleHelper';
import { computeSocialVideoDrawRect, sliceAndFadeChannels } from './audioFadeHelper';

test('parseSubtitles, shiftSubtitleCues, and formatSubtitles convert SRT <-> VTT <-> TXT cleanly', () => {
  assert.equal(parseTimestampToMs('00:01:02,500'), 62500);
  assert.equal(formatMsToTimestamp(62500, '.'), '00:01:02.500');

  const cues = parseSubtitles(SAMPLE_SRT_SUBTITLE);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startMs, 1000);
  assert.equal(cues[0].endMs, 4200);

  const shifted = shiftSubtitleCues(cues, 1500);
  assert.equal(shifted[0].startMs, 2500);
  assert.equal(shifted[0].endMs, 5700);

  // Negative shift clamps cleanly at 0
  const clamped = shiftSubtitleCues(cues, -2000);
  assert.equal(clamped[0].startMs, 0);

  const vtt = formatSubtitles(shifted, 'vtt');
  assert.ok(vtt.startsWith('WEBVTT\n\n'));
  assert.ok(vtt.includes('00:00:02.500 --> 00:00:05.700'));

  const txt = formatSubtitles(cues, 'txt', false);
  assert.ok(txt.includes('Welcome to NexcTool Subtitle Converter.'));
});

test('sliceAndFadeChannels trims selection and applies fade-in and fade-out ramps', () => {
  const sr = 1000;
  const input = new Float32Array(4000).fill(0.8); // 4 seconds flat signal
  const [out] = sliceAndFadeChannels([input], sr, 1, 3, 0.5, 0.5, 1);

  assert.equal(out.length, 2000); // 2 seconds selected
  assert.equal(out[0], 0); // start of fade-in is 0
  assert.ok(out[250] > 0.35 && out[250] < 0.45); // halfway into 0.5s fade-in
  assert.ok(Math.abs(out[1000] - 0.8) < 0.001); // flat middle
  assert.equal(out[out.length - 1], 0); // end of fade-out is 0
});

test('computeSocialVideoDrawRect centers 16:9 landscape inside 9:16 portrait cleanly', () => {
  const contained = computeSocialVideoDrawRect(1920, 1080, 720, 1280, 'contain');
  assert.equal(Math.round(contained.dw), 720);
  assert.equal(Math.round(contained.dh), 405);
  assert.equal(contained.dx, 0);
  assert.ok(contained.dy > 400);

  const covered = computeSocialVideoDrawRect(1920, 1080, 720, 1280, 'cover');
  assert.equal(Math.round(covered.dh), 1280);
  assert.ok(covered.dw > 2000);
});
