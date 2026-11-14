import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVideoCompressionPlan, getVideoMimeCandidates } from './videoCompression';

test('computeVideoCompressionPlan reduces bitrate and scales large 4K/1080p dimensions evenly', () => {
  const highResLowQ = computeVideoCompressionPlan({
    naturalWidth: 3840,
    naturalHeight: 2160,
    fileSizeBytes: 12_000_000,
    durationSec: 10,
    quality: 40,
  });
  assert.equal(highResLowQ.targetWidth, 854);
  assert.equal(highResLowQ.targetHeight, 480);
  assert.equal(highResLowQ.targetWidth % 2, 0);
  assert.equal(highResLowQ.targetHeight % 2, 0);
  assert.ok(highResLowQ.videoBitsPerSecond < 1_000_000);

  const moderateClip = computeVideoCompressionPlan({
    naturalWidth: 1280,
    naturalHeight: 720,
    fileSizeBytes: 150_000,
    durationSec: 2,
    quality: 80,
  });
  // Original bitrate is 600 kbps; compressed bitrate must be strictly below original bitrate
  assert.ok(moderateClip.videoBitsPerSecond < 600_000);
  assert.ok(moderateClip.videoBitsPerSecond >= 90_000);
  assert.equal(moderateClip.targetWidth, 1280);
  assert.equal(moderateClip.targetHeight, 720);
});

test('getVideoMimeCandidates separates audio+video and video-only codec lists', () => {
  const mp4NoAudio = getVideoMimeCandidates(true, false);
  assert.equal(mp4NoAudio[0].ext, 'mp4');
  assert.ok(!mp4NoAudio.some((c) => c.mime.includes('opus') || c.mime.includes('mp4a')));

  const mp4WithAudio = getVideoMimeCandidates(true, true);
  assert.ok(mp4WithAudio.some((c) => c.mime === 'video/mp4;codecs=avc1,mp4a.40.2'));
  assert.ok(mp4WithAudio.some((c) => c.mime === 'video/mp4;codecs=avc1,opus'));
  // Every codecs= entry in audio-enabled list must include an audio codec
  for (const c of mp4WithAudio) {
    if (c.mime.includes('codecs=')) {
      assert.ok(c.mime.includes('mp4a') || c.mime.includes('opus'), `Expected audio codec in ${c.mime}`);
    }
  }

  const webmWithAudio = getVideoMimeCandidates(false, true);
  assert.equal(webmWithAudio[0].mime, 'video/webm;codecs=vp9,opus');
});
