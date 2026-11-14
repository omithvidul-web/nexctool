import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearRecentTools,
  getPinnedSlugs,
  getRecentSlugs,
  parseStoredSlugs,
  recordRecentSlug,
  recordRecentTool,
  togglePinnedSlug,
  togglePinnedTool,
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

test('clearRecentTools clears recent tools while keeping pinned tools intact', () => {
  const store = new Map<string, string>();
  const dispatched: string[] = [];
  const prevWindow = (globalThis as { window?: unknown }).window;

  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    dispatchEvent: (evt: { type?: string }) => {
      if (evt?.type) dispatched.push(evt.type);
    },
  };

  try {
    togglePinnedTool('image-to-pdf');
    togglePinnedTool('jpg-to-png');
    recordRecentTool('image-compressor');
    recordRecentTool('png-to-jpg');

    assert.deepEqual(getPinnedSlugs(), ['jpg-to-png', 'image-to-pdf']);
    assert.deepEqual(getRecentSlugs(), ['png-to-jpg', 'image-compressor']);

    clearRecentTools();

    assert.deepEqual(getRecentSlugs(), []);
    assert.deepEqual(getPinnedSlugs(), ['jpg-to-png', 'image-to-pdf']);
    assert.ok(dispatched.length >= 1);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
});
