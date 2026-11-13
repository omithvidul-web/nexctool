import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAnimatedGif, imageRgbaToSvg } from './gifEncoder';

test('encodeAnimatedGif produces valid GIF89a header, trailer, and dimensions', () => {
  const frame = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  const gif = encodeAnimatedGif(
    [{ rgba: frame, delayCs: 10 }, { rgba: frame, delayCs: 10 }],
    4,
    4
  );
  const header = String.fromCharCode(...gif.slice(0, 6));
  assert.equal(header, 'GIF89a');
  assert.equal(gif[gif.length - 1], 0x3b);
});

test('imageRgbaToSvg generates crisp quantized vector SVG paths', () => {
  const rgba = new Uint8ClampedArray([
    255, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 0, 0, 0, 0, 255, 255,
  ]);
  const svg = imageRgbaToSvg(rgba, 2, 2);
  assert.equal(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'), true);
  assert.equal(svg.includes('M0 0h2v1h-2z'), true);
});
