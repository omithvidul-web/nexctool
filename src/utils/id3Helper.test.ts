import test from 'node:test';
import assert from 'node:assert/strict';
import { applyId3v2Metadata, stripExistingId3v2 } from './id3Helper';

test('applyId3v2Metadata prepends ID3v2.4 header and preserves audio body', () => {
  const fakeMp3Frames = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x01, 0x02, 0x03]);
  const tagged = applyId3v2Metadata(fakeMp3Frames, {
    title: 'NexcTool Track',
    artist: 'Omith',
    album: 'Local Studio',
  });
  assert.equal(String.fromCharCode(tagged[0], tagged[1], tagged[2]), 'ID3');
  assert.equal(tagged[3], 4);
  const stripped = stripExistingId3v2(tagged);
  assert.deepEqual(Array.from(stripped), Array.from(fakeMp3Frames));

  // Re-tagging replaces old ID3 header instead of stacking headers
  const retagged = applyId3v2Metadata(tagged, { title: 'Updated Title' });
  const strippedAgain = stripExistingId3v2(retagged);
  assert.deepEqual(Array.from(strippedAgain), Array.from(fakeMp3Frames));
});
