import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocxBytes,
  extractDocxParagraphs,
  createOdtBytes,
  extractOdtParagraphs,
  createPptxBytes,
  extractPptxSlides,
  rtfToPlainText,
  plainTextToRtf,
  createEpubBytes,
  extractEpubText,
} from './ooxmlHelper';

test('DOCX roundtrip preserves paragraphs cleanly', async () => {
  const bytes = await createDocxBytes(['First paragraph', 'Second line & symbols < >']);
  const paragraphs = await extractDocxParagraphs(bytes);
  assert.deepEqual(paragraphs, ['First paragraph', 'Second line & symbols < >']);
});

test('ODT and RTF roundtrip preserves text cleanly', async () => {
  const odt = await createOdtBytes(['ODT Title', 'Body text']);
  assert.deepEqual(await extractOdtParagraphs(odt), ['ODT Title', 'Body text']);

  const rtf = plainTextToRtf(['Line One', 'Line Two']);
  assert.equal(rtfToPlainText(rtf), 'Line One\nLine Two');
});

test('PPTX and EPUB roundtrip extracts slides and chapters cleanly', async () => {
  const pptx = await createPptxBytes([
    { title: 'Deck Intro', lines: ['Point A', 'Point B'] },
    { title: 'Summary', lines: ['Thank you'] },
  ]);
  const slides = await extractPptxSlides(pptx);
  assert.equal(slides.length, 2);
  assert.equal(slides[0].title, 'Deck Intro');
  assert.deepEqual(slides[0].lines, ['Point A', 'Point B']);

  const epub = await createEpubBytes('Sample Book', [
    { heading: 'Chapter 1', text: 'Once upon a time.' },
  ]);
  const chaps = await extractEpubText(epub);
  assert.equal(chaps.length, 1);
  assert.equal(chaps[0].includes('Once upon a time.'), true);
});
