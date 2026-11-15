import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  docType: 'INVOICE' | 'RECEIPT' | 'QUOTE';
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currencySymbol: string;
  accentHex: string;
  fromName: string;
  fromDetails: string;
  toName: string;
  toDetails: string;
  items: InvoiceLineItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
  logoBytes?: Uint8Array;
  logoMime?: 'image/png' | 'image/jpeg';
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
}

export function computeInvoiceTotals(
  items: Pick<InvoiceLineItem, 'quantity' | 'unitPrice'>[],
  discountPercent: number,
  taxPercent: number
): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => {
    const q = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    const p = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice) : 0;
    return sum + q * p;
  }, 0);

  const safeDiscountPct = Math.max(0, Math.min(100, Number.isFinite(discountPercent) ? discountPercent : 0));
  const safeTaxPct = Math.max(0, Math.min(100, Number.isFinite(taxPercent) ? taxPercent : 0));

  const discountAmount = subtotal * (safeDiscountPct / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * (safeTaxPct / 100);
  const grandTotal = taxableAmount + taxAmount;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    grandTotal,
  };
}

export function formatMoney(amount: number, currencySymbol: string): string {
  const fixed = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol}${fixed}`;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [79 / 255, 70 / 255, 229 / 255];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return [79 / 255, 70 / 255, 229 / 255];
  return [r, g, b];
}

function sanitizePdfText(input: string): string {
  // Standard PDF WinAnsi fonts only support basic Latin/Latin-1 reliably
  return input
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');
}

export async function buildInvoicePdfBytes(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await pdfDocCreate(data);
  return pdfDoc.save();
}

async function pdfDocCreate(data: InvoiceData): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${data.docType} ${data.invoiceNumber}`);
  pdfDoc.setAuthor(sanitizePdfText(data.fromName || 'NexcTool'));
  pdfDoc.setCreator('NexcTool Invoice PDF Generator');

  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const margin = 46;
  const contentWidth = pageWidth - margin * 2;

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [ar, ag, ab] = hexToRgbTuple(data.accentHex);
  const accentColor = rgb(ar, ag, ab);
  const darkText = rgb(0.08, 0.11, 0.17);
  const mutedText = rgb(0.39, 0.45, 0.55);
  const borderLight = rgb(0.88, 0.9, 0.94);
  const surfaceSoft = rgb(0.97, 0.98, 0.99);

  // Top accent bar
  page.drawRectangle({
    x: 0,
    y: pageHeight - 10,
    width: pageWidth,
    height: 10,
    color: accentColor,
  });

  let topY = pageHeight - 48;

  // Optional logo
  let textStartX = margin;
  if (data.logoBytes && data.logoBytes.byteLength > 0) {
    try {
      const embedded =
        data.logoMime === 'image/png'
          ? await pdfDoc.embedPng(data.logoBytes)
          : await pdfDoc.embedJpg(data.logoBytes);
      const maxH = 44;
      const scale = Math.min(1, maxH / embedded.height, 110 / embedded.width);
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;
      page.drawImage(embedded, {
        x: margin,
        y: topY - drawH + 12,
        width: drawW,
        height: drawH,
      });
      textStartX = margin + drawW + 14;
    } catch {
      // Ignore invalid logo buffer gracefully
    }
  }

  // Sender name on left
  page.drawText(sanitizePdfText(data.fromName || 'Your Business Name'), {
    x: textStartX,
    y: topY,
    size: 16,
    font: fontBold,
    color: darkText,
  });

  // Document type & number on right
  const docLabel = sanitizePdfText(data.docType || 'INVOICE');
  const docLabelWidth = fontBold.widthOfTextAtSize(docLabel, 22);
  page.drawText(docLabel, {
    x: pageWidth - margin - docLabelWidth,
    y: topY - 2,
    size: 22,
    font: fontBold,
    color: accentColor,
  });

  const numText = sanitizePdfText(`# ${data.invoiceNumber || 'INV-001'}`);
  const numWidth = fontRegular.widthOfTextAtSize(numText, 10.5);
  page.drawText(numText, {
    x: pageWidth - margin - numWidth,
    y: topY - 20,
    size: 10.5,
    font: fontRegular,
    color: mutedText,
  });

  // Sender details lines
  const fromLines = sanitizePdfText(data.fromDetails || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);
  let fromY = topY - 20;
  for (const line of fromLines) {
    page.drawText(line, {
      x: textStartX,
      y: fromY,
      size: 9.5,
      font: fontRegular,
      color: mutedText,
    });
    fromY -= 13;
  }

  // Divider
  let cursorY = Math.min(fromY, topY - 56) - 18;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: pageWidth - margin, y: cursorY },
    thickness: 1,
    color: borderLight,
  });

  // Bill To + Dates row
  cursorY -= 22;
  page.drawText('BILL TO', {
    x: margin,
    y: cursorY,
    size: 8.5,
    font: fontBold,
    color: accentColor,
  });

  page.drawText(sanitizePdfText(data.toName || 'Client Name'), {
    x: margin,
    y: cursorY - 16,
    size: 12,
    font: fontBold,
    color: darkText,
  });

  const toLines = sanitizePdfText(data.toDetails || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);
  let toY = cursorY - 31;
  for (const line of toLines) {
    page.drawText(line, {
      x: margin,
      y: toY,
      size: 9.5,
      font: fontRegular,
      color: mutedText,
    });
    toY -= 13;
  }

  // Dates on right
  const rightMetaX = pageWidth - margin - 165;
  page.drawText('ISSUE DATE', {
    x: rightMetaX,
    y: cursorY,
    size: 8.5,
    font: fontBold,
    color: mutedText,
  });
  page.drawText(sanitizePdfText(data.issueDate || '-'), {
    x: rightMetaX,
    y: cursorY - 14,
    size: 10,
    font: fontRegular,
    color: darkText,
  });

  if (data.dueDate?.trim()) {
    page.drawText(data.docType === 'RECEIPT' ? 'PAID DATE' : 'DUE DATE', {
      x: rightMetaX,
      y: cursorY - 36,
      size: 8.5,
      font: fontBold,
      color: mutedText,
    });
    page.drawText(sanitizePdfText(data.dueDate), {
      x: rightMetaX,
      y: cursorY - 50,
      size: 10,
      font: fontRegular,
      color: darkText,
    });
  }

  // Table header
  cursorY = Math.min(toY, cursorY - 68) - 24;
  const colDescX = margin + 10;
  const colQtyX = margin + contentWidth * 0.6;
  const colPriceX = margin + contentWidth * 0.77;
  const colTotalRightX = pageWidth - margin - 10;

  page.drawRectangle({
    x: margin,
    y: cursorY - 7,
    width: contentWidth,
    height: 24,
    color: surfaceSoft,
    borderColor: borderLight,
    borderWidth: 1,
  });

  page.drawText('DESCRIPTION', { x: colDescX, y: cursorY + 1, size: 8.5, font: fontBold, color: mutedText });
  page.drawText('QTY', { x: colQtyX, y: cursorY + 1, size: 8.5, font: fontBold, color: mutedText });
  page.drawText('RATE', { x: colPriceX, y: cursorY + 1, size: 8.5, font: fontBold, color: mutedText });
  const amtHeadW = fontBold.widthOfTextAtSize('AMOUNT', 8.5);
  page.drawText('AMOUNT', { x: colTotalRightX - amtHeadW, y: cursorY + 1, size: 8.5, font: fontBold, color: mutedText });

  cursorY -= 26;

  // Line items
  for (const item of data.items) {
    if (cursorY < 130) {
      page = pdfDoc.addPage([595.28, 841.89]);
      cursorY = pageHeight - 60;
    }

    const lineAmount = Math.max(0, item.quantity) * Math.max(0, item.unitPrice);
    const desc = sanitizePdfText(item.description || 'Item').slice(0, 56);
    const qtyStr = String(item.quantity);
    const rateStr = sanitizePdfText(formatMoney(item.unitPrice, data.currencySymbol));
    const amtStr = sanitizePdfText(formatMoney(lineAmount, data.currencySymbol));
    const amtW = fontBold.widthOfTextAtSize(amtStr, 9.5);

    page.drawText(desc, { x: colDescX, y: cursorY, size: 9.5, font: fontRegular, color: darkText });
    page.drawText(qtyStr, { x: colQtyX, y: cursorY, size: 9.5, font: fontRegular, color: darkText });
    page.drawText(rateStr, { x: colPriceX, y: cursorY, size: 9.5, font: fontRegular, color: darkText });
    page.drawText(amtStr, { x: colTotalRightX - amtW, y: cursorY, size: 9.5, font: fontBold, color: darkText });

    page.drawLine({
      start: { x: margin, y: cursorY - 9 },
      end: { x: pageWidth - margin, y: cursorY - 9 },
      thickness: 0.6,
      color: borderLight,
    });

    cursorY -= 25;
  }

  // Totals block
  const totals = computeInvoiceTotals(data.items, data.discountPercent, data.taxPercent);
  cursorY -= 10;
  const labelX = margin + contentWidth * 0.58;

  const drawTotalRow = (label: string, valueStr: string, bold = false, highlight = false) => {
    const f = bold ? fontBold : fontRegular;
    const sz = bold ? 11.5 : 9.5;
    const c = highlight ? accentColor : darkText;
    const valClean = sanitizePdfText(valueStr);
    const vw = f.widthOfTextAtSize(valClean, sz);
    page.drawText(label, { x: labelX, y: cursorY, size: sz, font: f, color: bold ? darkText : mutedText });
    page.drawText(valClean, { x: colTotalRightX - vw, y: cursorY, size: sz, font: f, color: c });
    cursorY -= bold ? 22 : 17;
  };

  drawTotalRow('Subtotal', formatMoney(totals.subtotal, data.currencySymbol));
  if (data.discountPercent > 0) {
    drawTotalRow(`Discount (${data.discountPercent}%)`, `-${formatMoney(totals.discountAmount, data.currencySymbol)}`);
  }
  if (data.taxPercent > 0) {
    drawTotalRow(`Tax (${data.taxPercent}%)`, formatMoney(totals.taxAmount, data.currencySymbol));
  }

  page.drawLine({
    start: { x: labelX, y: cursorY + 12 },
    end: { x: pageWidth - margin, y: cursorY + 12 },
    thickness: 1.2,
    color: accentColor,
  });
  cursorY -= 2;
  drawTotalRow('Total Due', formatMoney(totals.grandTotal, data.currencySymbol), true, true);

  // Notes section
  if (data.notes?.trim()) {
    cursorY -= 16;
    page.drawText('NOTES / PAYMENT TERMS', {
      x: margin,
      y: cursorY,
      size: 8.5,
      font: fontBold,
      color: accentColor,
    });
    cursorY -= 14;
    const noteLines = sanitizePdfText(data.notes).split(/\r?\n/).slice(0, 6);
    for (const line of noteLines) {
      page.drawText(line.slice(0, 95), {
        x: margin,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: mutedText,
      });
      cursorY -= 13;
    }
  }

  // Footer
  page.drawText('Generated locally in browser with NexcTool — 100% Private', {
    x: margin,
    y: 28,
    size: 8,
    font: fontRegular,
    color: mutedText,
  });

  return pdfDoc;
}
