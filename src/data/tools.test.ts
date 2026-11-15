import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  TOOLS,
  POPULAR_TOOLS,
  getCategoryBySlug,
  getToolBySlug,
  getToolsByCategory,
  searchTools,
} from './tools';

test('catalog has exact 219 tools and 10 categories', () => {
  assert.equal(CATEGORIES.length, 10);
  assert.equal(TOOLS.length, 219);
  assert.equal(POPULAR_TOOLS.length, 12);
});

test('every category matches its expected tool count', () => {
  for (const cat of CATEGORIES) {
    const tools = getToolsByCategory(cat.slug);
    assert.equal(tools.length, cat.expectedCount, `Category ${cat.name} count mismatch`);
  }
});

test('all tool slugs and ids are unique', () => {
  const slugs = new Set(TOOLS.map((t) => t.slug));
  const ids = new Set(TOOLS.map((t) => t.id));
  assert.equal(slugs.size, 219);
  assert.equal(ids.size, 219);
});

test('the 5 required core tools exist and are browser-enabled', () => {
  const requiredSlugs = ['jpg-to-png', 'png-to-jpg', 'image-compressor', 'merge-pdf', 'json-formatter'];
  for (const slug of requiredSlugs) {
    const tool = getToolBySlug(slug);
    assert.ok(tool, `Missing required tool: ${slug}`);
    assert.notEqual(tool.mode, 'coming-soon', `Tool ${slug} must be enabled`);
  }
});

test('all 10 separate developer preview tools exist with distinct slugs and previewKind', () => {
  const previewSlugs = [
    'html-preview',
    'css-preview',
    'javascript-runner',
    'python-runner',
    'json-viewer',
    'markdown-preview',
    'xml-viewer',
    'sql-formatter-preview',
    'regex-tester',
    'text-diff',
  ];
  const seenKinds = new Set<string>();
  for (const slug of previewSlugs) {
    const tool = getToolBySlug(slug);
    assert.ok(tool, `Missing preview tool: ${slug}`);
    assert.equal(tool.category, 'text-developer-tools');
    assert.equal(tool.mode, 'text-or-file');
    assert.ok(tool.previewKind, `Missing previewKind on ${slug}`);
    seenKinds.add(tool.previewKind);
  }
  assert.equal(seenKinds.size, 10);
});

test('searchTools returns accurate ranked matches', () => {
  const jsonResults = searchTools('json');
  assert.ok(jsonResults.length >= 5);
  assert.equal(jsonResults[0].slug.includes('json'), true);
  assert.equal(getCategoryBySlug('image-tools')?.name, 'Image Tools');
});

test('all 12 popular tools and newly activated tools are browser-enabled', () => {
  for (const pop of POPULAR_TOOLS) {
    assert.notEqual(pop.mode, 'coming-soon', `Popular tool ${pop.slug} should be active`);
  }
  const activated = [
    'zip-creator',
    'zip-extractor',
    'tar-creator',
    'tar-extractor',
    'archive-converter',
    'archive-file-viewer',
    'md5-generator',
    'image-watermark',
    'image-cropper',
    'image-background-remover',
    'heic-to-jpg',
    'tiff-to-png',
    'png-to-svg',
    'batch-image-converter',
    'pdf-watermark',
    'extract-pdf-pages',
    'delete-pdf-pages',
    'pdf-to-jpg',
    'pdf-to-txt',
    'pdf-to-word',
    'word-to-pdf',
    'pdf-signer',
    'pdf-compare',
    'docx-to-txt',
    'txt-to-docx',
    'epub-to-txt',
    'csv-to-xlsx',
    'xlsx-to-json',
    'excel-sheet-merger',
    'spreadsheet-formula-checker',
    'pptx-to-png',
    'pptx-to-pdf',
    'pptx-merger',
    'wav-to-mp3',
    'audio-trimmer',
    'audio-speed-changer',
    'audio-metadata-editor',
    'video-to-gif',
    'mp4-to-webm',
    'video-trimmer',
    'yaml-to-json',
    'xml-to-json',
    'html-to-markdown',
  ];
  for (const slug of activated) {
    const tool = getToolBySlug(slug);
    assert.ok(tool, `Missing activated tool: ${slug}`);
    assert.notEqual(tool.mode, 'coming-soon', `Activated tool ${slug} should not be coming-soon`);
    assert.ok(tool.lazyGroup, `Activated tool ${slug} must define lazyGroup`);
  }

  const activeTotal = TOOLS.filter((t) => t.mode !== 'coming-soon').length;
  assert.ok(activeTotal >= 195, `Expected at least 195 active tools, got ${activeTotal}`);
});

test('10 new interactive utility, media, creator, and OCR tools exist with distinct slugs and interactiveKind', () => {
  const newSlugs = [
    'qr-code-generator-scanner',
    'favicon-generator',
    'image-blur-redactor',
    'image-collage-joiner',
    'invoice-pdf-generator',
    'image-to-text-ocr',
    'screen-voice-recorder',
    'subtitle-converter-shifter',
    'social-video-resizer',
    'ringtone-maker',
  ];
  const kinds = new Set<string>();
  for (const slug of newSlugs) {
    const tool = getToolBySlug(slug);
    assert.ok(tool, `Missing new tool: ${slug}`);
    assert.notEqual(tool.mode, 'coming-soon', `New tool ${slug} should be active`);
    assert.ok(tool.interactiveKind, `Missing interactiveKind on ${slug}`);
    kinds.add(tool.interactiveKind);
  }
  assert.equal(kinds.size, 10);
});



