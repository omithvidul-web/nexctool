import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptBytesAesGcm, encryptBytesAesGcm } from './fileCryptoHelper';
import { decodeJwtToken, SAMPLE_JWT_TOKEN } from './jwtHelper';
import { generateSecurePassword, generateUuidV4Batch } from './passwordUuidHelper';
import { computeWcagContrast, extractPaletteFromRgba, rgbToHslString } from './colorContrastHelper';
import { buildChartSvg, parseChartInput, SAMPLE_CHART_CSV } from './chartDataHelper';
import { convertUnixTimestamp, explainAndComputeCron } from './timestampCronHelper';

test('AES-256-GCM encryptBytesAesGcm and decryptBytesAesGcm roundtrip with filename and reject wrong password', async () => {
  const payload = new TextEncoder().encode('Top secret browser-only document contents!');
  const encrypted = await encryptBytesAesGcm(payload, 'secret-note.txt', 'StrongPass#2026');
  assert.equal(new TextDecoder().decode(encrypted.slice(0, 4)), 'NXC1');

  const decrypted = await decryptBytesAesGcm(encrypted, 'StrongPass#2026');
  assert.equal(decrypted.filename, 'secret-note.txt');
  assert.deepEqual(decrypted.data, payload);

  await assert.rejects(() => decryptBytesAesGcm(encrypted, 'WrongPass'), /Incorrect password/);
});

test('decodeJwtToken parses header, payload, and timestamps cleanly', () => {
  const decoded = decodeJwtToken(SAMPLE_JWT_TOKEN, 1750000000 * 1000);
  assert.equal(decoded.algorithm, 'HS256');
  assert.equal(decoded.payload.role, 'admin');
  assert.equal(decoded.isExpired, false);
  assert.ok(decoded.expiresAtIso?.startsWith('2030-'));
});

test('generateSecurePassword and generateUuidV4Batch produce valid outputs', () => {
  const pw = generateSecurePassword({
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: true,
  });
  assert.equal(pw.password.length, 20);
  assert.ok(pw.entropyBits >= 90);
  assert.equal(pw.strengthLabel, 'Very Strong');

  const uuids = generateUuidV4Batch(5, true, false);
  assert.equal(uuids.length, 5);
  assert.equal(new Set(uuids).size, 5);
  assert.match(uuids[0], /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
});

test('computeWcagContrast and extractPaletteFromRgba compute accurate ratios and swatches', () => {
  const bw = computeWcagContrast('#000000', '#FFFFFF');
  assert.ok(bw);
  assert.equal(bw.ratioFormatted, '21.00:1');
  assert.equal(bw.aaaNormal, true);

  assert.equal(rgbToHslString({ r: 255, g: 0, b: 0 }), 'hsl(0, 100%, 50%)');

  // 4 indigo pixels, 2 emerald pixels
  const rgba = new Uint8ClampedArray([
    79, 70, 229, 255,
    79, 70, 229, 255,
    79, 70, 229, 255,
    79, 70, 229, 255,
    16, 185, 129, 255,
    16, 185, 129, 255,
  ]);
  const swatches = extractPaletteFromRgba(rgba, 4);
  assert.equal(swatches.length, 2);
  assert.equal(swatches[0].hex, '#4F46E5');
});

test('parseChartInput and buildChartSvg generate valid Bar, Line, and Pie SVGs', () => {
  const dataset = parseChartInput(SAMPLE_CHART_CSV);
  assert.equal(dataset.labels.length, 6);
  assert.equal(dataset.series.length, 2);

  const barSvg = buildChartSvg(dataset, 'bar', 'Monthly Metrics');
  assert.ok(barSvg.startsWith('<svg') && barSvg.includes('<rect'));

  const pieSvg = buildChartSvg(dataset, 'pie', 'Share');
  assert.ok(pieSvg.includes('<path'));
});

test('convertUnixTimestamp and explainAndComputeCron return accurate times and schedules', () => {
  const conv = convertUnixTimestamp(1700000000, 1700003600 * 1000);
  assert.equal(conv.seconds, 1700000000);
  assert.equal(conv.isoUtc, '2023-11-14T22:13:20.000Z');
  assert.equal(conv.relativeText, '1 hour ago');

  const cron = explainAndComputeCron('*/15 9-17 * * 1-5', new Date('2026-11-16T08:50:00Z'), 3);
  assert.equal(cron.nextRunsUtc.length, 3);
  assert.equal(cron.nextRunsUtc[0], '2026-11-16 09:00:00 UTC');
  assert.equal(cron.nextRunsUtc[1], '2026-11-16 09:15:00 UTC');
});
