import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcoFromPngFrames, buildWebManifestJson } from './icoBuilder';
import { formatQrPayload, isHttpUrl } from './qrPayload';
import { computeCollageLayout } from './collageLayout';
import { buildInvoicePdfBytes, computeInvoiceTotals } from './invoicePdfBuilder';

test('buildIcoFromPngFrames generates valid ICO header and directory entries', () => {
  const png16 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const png32 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8, 9, 10]);
  const ico = buildIcoFromPngFrames([
    { width: 16, height: 16, pngBytes: png16 },
    { width: 32, height: 32, pngBytes: png32 },
  ]);

  const view = new DataView(ico.buffer);
  assert.equal(view.getUint16(0, true), 0); // reserved
  assert.equal(view.getUint16(2, true), 1); // icon type
  assert.equal(view.getUint16(4, true), 2); // 2 frames
  assert.equal(ico[6], 16); // frame 0 width
  assert.equal(ico[22], 32); // frame 1 width
  assert.equal(ico.byteLength, 6 + 32 + png16.byteLength + png32.byteLength);

  const manifest = JSON.parse(buildWebManifestJson('NexcTool', '#4F46E5', '#FFFFFF'));
  assert.equal(manifest.name, 'NexcTool');
  assert.equal(manifest.icons.length, 2);
});

test('formatQrPayload produces valid Text, Wi-Fi, Email, and Phone payloads', () => {
  assert.equal(formatQrPayload({ type: 'text', text: 'https://nexctool.com' }), 'https://nexctool.com');
  assert.equal(
    formatQrPayload({ type: 'wifi', text: '', wifiSsid: 'HomeNet', wifiPassword: 'pass;word', wifiEncryption: 'WPA' }),
    'WIFI:T:WPA;S:HomeNet;P:pass\\;word;;'
  );
  assert.equal(
    formatQrPayload({ type: 'email', text: '', emailTo: 'hi@nexctool.com', emailSubject: 'Hello' }),
    'mailto:hi@nexctool.com?subject=Hello'
  );
  assert.equal(formatQrPayload({ type: 'phone', text: '', phone: '+94771234567' }), 'tel:+94771234567');
  assert.equal(isHttpUrl('https://nexctool.com'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
});

test('computeCollageLayout calculates non-overlapping tiles for horizontal, vertical, and grid modes', () => {
  const sources = [
    { width: 1000, height: 800 },
    { width: 800, height: 1000 },
    { width: 1200, height: 900 },
  ];
  const horiz = computeCollageLayout(sources, 'horizontal', 1200, 16, 20);
  assert.equal(horiz.tiles.length, 3);
  assert.ok(horiz.tiles[1].x > horiz.tiles[0].x + horiz.tiles[0].width);

  const vert = computeCollageLayout(sources, 'vertical', 1000, 12, 24);
  assert.equal(vert.tiles.length, 3);
  assert.ok(vert.tiles[1].y > vert.tiles[0].y + vert.tiles[0].height);

  const grid = computeCollageLayout(sources, 'grid-2x2', 1200, 16, 16);
  assert.equal(grid.tiles.length, 3);
  assert.equal(grid.tiles[2].y > grid.tiles[0].y, true);
});

test('computeInvoiceTotals and buildInvoicePdfBytes produce valid PDF bytes', async () => {
  const totals = computeInvoiceTotals(
    [
      { quantity: 2, unitPrice: 100 },
      { quantity: 1, unitPrice: 50 },
    ],
    10,
    15
  );
  assert.equal(totals.subtotal, 250);
  assert.equal(totals.discountAmount, 25);
  assert.equal(totals.taxableAmount, 225);
  assert.equal(totals.taxAmount, 33.75);
  assert.equal(totals.grandTotal, 258.75);

  const pdfBytes = await buildInvoicePdfBytes({
    docType: 'INVOICE',
    invoiceNumber: 'INV-2026-01',
    issueDate: '2026-11-15',
    dueDate: '2026-11-30',
    currencySymbol: '$',
    accentHex: '#4F46E5',
    fromName: 'NexcTool Studio',
    fromDetails: 'Colombo, Sri Lanka\nomithvidul@gmail.com',
    toName: 'Acme Corp',
    toDetails: '123 Main Street',
    items: [{ id: '1', description: 'Web Design & Development', quantity: 2, unitPrice: 100 }],
    discountPercent: 10,
    taxPercent: 15,
    notes: 'Thank you for your business.',
  });

  assert.ok(pdfBytes.byteLength > 800);
  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  assert.equal(header, '%PDF-');
});
