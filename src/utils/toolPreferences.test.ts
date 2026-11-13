import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStoredSlugs,
  recordRecentSlug,
  togglePinnedSlug,
} from './toolPreferences';

test('parseStoredSlugs handles invalid, duplicate, and valid inputs safely', () => {
  assert.deepEqual(parseStoredSlugs(null), []);
  assert.deepEqual(parseStoredSlugs('not-json'), []);
  assert.deepEqual(parseStoredSlugs('{"a":1}'), []);
  assert.deepEqual(
    parseStoredSlugs(JSON.stringify(['jpg-to-png', '', 42, 'merge-pdf', 'jpg-to-png'])),
    ['jpg-to-png', 'merge-pdf']
  );
});

test('togglePinnedSlug adds, removes, and caps at maxPinned', () => {
  let pinned: string[] = [];
  pinned = togglePinnedSlug(pinned, 'jpg-to-png', 3);
  assert.deepEqual(pinned, ['jpg-to-png']);

  pinned = togglePinnedSlug(pinned, 'merge-pdf', 3);
  assert.deepEqual(pinned, ['merge-pdf', 'jpg-to-png']);

  pinned = togglePinnedSlug(pinned, 'json-formatter', 3);
  pinned = togglePinnedSlug(pinned, 'zip-creator', 3);
  assert.deepEqual(pinned, ['zip-creator', 'json-formatter', 'merge-pdf']);

  pinned = togglePinnedSlug(pinned, 'json-formatter', 3);
  assert.deepEqual(pinned, ['zip-creator', 'merge-pdf']);
});

test('recordRecentSlug moves existing slug to front and caps history length', () => {
  let recent: string[] = [];
  for (const slug of ['a', 'b', 'c', 'd']) {
    recent = recordRecentSlug(recent, slug, 3);
  }
  assert.deepEqual(recent, ['d', 'c', 'b']);

  recent = recordRecentSlug(recent, 'b', 3);
  assert.deepEqual(recent, ['b', 'd', 'c']);
});
