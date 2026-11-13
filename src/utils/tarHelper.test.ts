import test from 'node:test';
import assert from 'node:assert/strict';
import { createTarArchive, extractTarArchive } from './tarHelper';

test('createTarArchive and extractTarArchive roundtrip files cleanly', () => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const tar = createTarArchive([
    { filename: 'hello.txt', data: enc.encode('Hello NexcTool TAR!') },
    { filename: 'nested/data.json', data: enc.encode('{"ok":true,"count":209}') },
  ]);

  assert.equal(tar.length % 512, 0);
  const extracted = extractTarArchive(tar);
  assert.equal(extracted.length, 2);
  assert.equal(extracted[0].filename, 'hello.txt');
  assert.equal(dec.decode(extracted[0].data), 'Hello NexcTool TAR!');
  assert.equal(extracted[1].filename, 'nested/data.json');
  assert.equal(dec.decode(extracted[1].data), '{"ok":true,"count":209}');
});
