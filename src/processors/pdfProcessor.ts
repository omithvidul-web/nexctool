import type { ProcessOptions, ProcessOutputFile, ProcessResult } from './types';
import { calculateSavingsPercent, formatBytes, replaceExtension } from '../utils/formatters';
import { createDocxBytes, createEpubBytes, createPptxBytes, extractDocxParagraphs } from '../utils/ooxmlHelper';

function toPdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}

function toBinaryBlob(bytes: Uint8Array | ArrayBuffer, mimeType: string): Blob {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return new Blob([copy.buffer], { type: mimeType });
}

export function parsePageRangeIndices(rangeInput: string | undefined, totalPages: number): number[] {
  const clean = (rangeInput ?? '').trim().toLowerCase();
  if (!clean || clean === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const chosen = new Set<number>();
  for (const part of clean.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Math.max(1, Number(rangeMatch[1]));
      const end = Math.min(totalPages, Number(rangeMatch[2]));
      for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
        if (p >= 1 && p <= totalPages) chosen.add(p - 1);
      }
      continue;
    }
    const single = Number(token);
    if (Number.isInteger(single) && single >= 1 && single <= totalPages) {
      chosen.add(single - 1);
    }
  }

  return Array.from(chosen).sort((a, b) => a - b);
}

export function parseOrderedPageSequence(orderInput: string | undefined, totalPages: number): number[] {
  const clean = (orderInput ?? '').trim();
  if (!clean) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const seq: number[] = [];
  for (const part of clean.split(',')) {
    const num = Number(part.trim());
    if (Number.isInteger(num) && num >= 1 && num <= totalPages) {
      seq.push(num - 1);
    }
  }
  return seq;
}

function stripInlineMarkdown(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

async function loadPdfJsDocument(buffer: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(new Uint8Array(buffer));
  return pdfjs.getDocument({ data: copy }).promise;
}

async function extractPdfTextPerPage(buffer: ArrayBuffer): Promise<string[]> {
  const doc = await loadPdfJsDocument(buffer);
  const pagesText: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let pageStr = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Array.isArray(item.transform) ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        pageStr += '\n';
      } else if (pageStr && !pageStr.endsWith('\n') && !pageStr.endsWith(' ')) {
        pageStr += ' ';
      }
      pageStr += item.str;
      if (y !== null) lastY = y;
    }
    pagesText.push(pageStr.trim());
  }
  return pagesText;
}

export async function processPdfTool(
  slug: string,
  files: File[],
  options: ProcessOptions
): Promise<ProcessResult> {
  if (files.length === 0) {
    throw new Error('Please select at least one file first.');
  }

  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');

  if (slug === 'merge-pdf') {
    if (files.length < 2) {
      throw new Error('Please select at least 2 PDF files to merge.');
    }
    const mergedPdf = await PDFDocument.create();
    let totalOriginal = 0;
    for (const file of files) {
      totalOriginal += file.size;
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const copiedPages = await mergedPdf.copyPages(src, src.getPageIndices());
      copiedPages.forEach((p) => mergedPdf.addPage(p));
    }
    const pdfBytes = await mergedPdf.save();
    const blob = toPdfBlob(pdfBytes);
    return {
      files: [{ blob, filename: 'merged-nexctool.pdf', mimeType: 'application/pdf', size: blob.size }],
      outputFilename: 'merged-nexctool.pdf',
      outputMimeType: 'application/pdf',
      summaryLines: [
        `Merged ${files.length} PDF files into ${mergedPdf.getPageCount()} pages`,
        `Output size: ${formatBytes(blob.size)}`,
      ],
      originalTotalBytes: totalOriginal,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-compare') {
    if (files.length < 2) {
      throw new Error('Please select 2 PDF files to compare.');
    }
    const [pagesA, pagesB] = await Promise.all([
      extractPdfTextPerPage(await files[0].arrayBuffer()),
      extractPdfTextPerPage(await files[1].arrayBuffer()),
    ]);
    const linesA = pagesA.join('\n').split('\n').map((s) => s.trim()).filter(Boolean);
    const linesB = pagesB.join('\n').split('\n').map((s) => s.trim()).filter(Boolean);
    const setA = new Set(linesA);
    const setB = new Set(linesB);
    const removed = linesA.filter((l) => !setB.has(l));
    const added = linesB.filter((l) => !setA.has(l));
    const report = [
      `PDF Compare Report`,
      `File A: ${files[0].name} (${pagesA.length} pages, ${linesA.length} lines)`,
      `File B: ${files[1].name} (${pagesB.length} pages, ${linesB.length} lines)`,
      `Differences: ${removed.length} removed, ${added.length} added`,
      '',
      ...removed.map((l) => `- ${l}`),
      ...added.map((l) => `+ ${l}`),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: 'pdf-diff.txt', mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: 'pdf-diff.txt',
      summaryLines: [`Compared ${pagesA.length} vs ${pagesB.length} PDF pages: ${added.length} added, ${removed.length} removed`],
    };
  }

  if (slug === 'image-to-pdf' || slug === 'jpg-to-pdf' || slug === 'png-to-pdf') {
    const pdfDoc = await PDFDocument.create();
    let totalOriginal = 0;
    for (const file of files) {
      totalOriginal += file.size;
      const bytes = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      const isPng = file.type === 'image/png' || lower.endsWith('.png');
      const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const page = pdfDoc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }
    const pdfBytes = await pdfDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = files.length === 1 ? replaceExtension(files[0].name, 'pdf') : 'images-nexctool.pdf';
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [
        `Created ${pdfDoc.getPageCount()}-page PDF from ${files.length} image(s)`,
        `Output size: ${formatBytes(blob.size)}`,
      ],
      originalTotalBytes: totalOriginal,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'txt-to-pdf' || slug === 'markdown-to-pdf' || slug === 'word-to-pdf') {
    const file = files[0];
    let text = '';
    if (slug === 'word-to-pdf') {
      const paras = await extractDocxParagraphs(await file.arrayBuffer());
      text = paras.join('\n\n');
    } else {
      text = await file.text();
    }

    const pdfDoc = await PDFDocument.create();
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 50;
    const pageWidth = 612;
    const pageHeight = 792;
    const maxWidth = pageWidth - margin * 2;

    interface StyledLine {
      text: string;
      fontSize: number;
      lineHeight: number;
      isHeading: boolean;
    }

    const styledLines: StyledLine[] = [];
    const rawLines = text.replace(/\r\n/g, '\n').split('\n');

    for (const rawLine of rawLines) {
      let line = rawLine;
      let fontSize = 11;
      let lineHeight = 16;
      let isHeading = false;

      if (slug === 'markdown-to-pdf') {
        if (line.startsWith('### ')) {
          fontSize = 13;
          lineHeight = 20;
          isHeading = true;
          line = stripInlineMarkdown(line.slice(4));
        } else if (line.startsWith('## ')) {
          fontSize = 16;
          lineHeight = 24;
          isHeading = true;
          line = stripInlineMarkdown(line.slice(3));
        } else if (line.startsWith('# ')) {
          fontSize = 20;
          lineHeight = 28;
          isHeading = true;
          line = stripInlineMarkdown(line.slice(2));
        } else if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ')) {
          line = `• ${stripInlineMarkdown(line.trimStart().slice(2))}`;
        } else {
          line = stripInlineMarkdown(line);
        }
      }

      if (!line.trim()) {
        styledLines.push({ text: '', fontSize, lineHeight: 10, isHeading: false });
        continue;
      }

      const activeFont = isHeading ? boldFont : bodyFont;
      const words = line.split(/\s+/);
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (activeFont.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          current = candidate;
        } else {
          if (current) styledLines.push({ text: current, fontSize, lineHeight, isHeading });
          current = word;
        }
      }
      if (current) styledLines.push({ text: current, fontSize, lineHeight, isHeading });
    }

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    for (const item of styledLines) {
      if (y < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      if (item.text) {
        page.drawText(item.text, {
          x: margin,
          y,
          size: item.fontSize,
          font: item.isHeading ? boldFont : bodyFont,
          color: rgb(0.06, 0.09, 0.16),
        });
      }
      y -= item.lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Converted document to ${pdfDoc.getPageCount()} PDF page(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  const file = files[0];
  const srcBytes = await file.arrayBuffer();

  // PDF.js Powered Rendering & Extraction Tools
  if (slug === 'pdf-to-jpg' || slug === 'pdf-to-png') {
    const isJpg = slug === 'pdf-to-jpg';
    const mime = isJpg ? 'image/jpeg' : 'image/png';
    const ext = isJpg ? 'jpg' : 'png';
    const q = Math.min(0.95, Math.max(0.2, (options.quality ?? 90) / 100));
    const doc = await loadPdfJsDocument(srcBytes);
    const outFiles: ProcessOutputFile[] = [];
    let firstPreview: string | undefined;

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1.75 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      if (isJpg) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to export rendered PDF page.'))),
          mime,
          isJpg ? q : undefined
        );
      });
      if (!firstPreview) {
        firstPreview = canvas.toDataURL(mime, isJpg ? q : undefined);
      }
      outFiles.push({
        blob,
        filename: replaceExtension(file.name, `page-${p}.${ext}`),
        mimeType: mime,
        size: blob.size,
      });
    }

    const totalOut = outFiles.reduce((a, f) => a + f.size, 0);
    return {
      files: outFiles,
      outputFilename: outFiles[0]?.filename,
      outputMimeType: mime,
      previewDataUrl: firstPreview,
      summaryLines: [`Rendered ${doc.numPages} PDF page(s) to ${ext.toUpperCase()} (${formatBytes(totalOut)})`],
      originalTotalBytes: file.size,
      outputTotalBytes: totalOut,
    };
  }

  if (slug === 'pdf-compressor') {
    const q = Math.min(0.9, Math.max(0.2, (options.quality ?? 65) / 100));
    const doc = await loadPdfJsDocument(srcBytes);
    const outPdf = await PDFDocument.create();

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const jpgBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression failed'))), 'image/jpeg', q);
      });
      const jpgEmbedded = await outPdf.embedJpg(await jpgBlob.arrayBuffer());
      const outPage = outPdf.addPage([viewport.width, viewport.height]);
      outPage.drawImage(jpgEmbedded, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }

    const compressedBytes = await outPdf.save({ useObjectStreams: true });
    const blob = toPdfBlob(compressedBytes);
    const savedPct = calculateSavingsPercent(file.size, blob.size);
    const filename = replaceExtension(file.name, 'compressed.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [
        `Processed ${doc.numPages} PDF page(s) at ${Math.round(q * 100)}% quality`,
        `${formatBytes(file.size)} → ${formatBytes(blob.size)}${savedPct > 0 ? ` (${savedPct}% smaller)` : ''}`,
      ],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (
    slug === 'pdf-to-txt' ||
    slug === 'pdf-text-extractor' ||
    slug === 'pdf-to-html' ||
    slug === 'pdf-to-markdown' ||
    slug === 'pdf-to-word' ||
    slug === 'pdf-to-excel' ||
    slug === 'pdf-to-powerpoint' ||
    slug === 'pdf-to-pptx' ||
    slug === 'pdf-to-epub'
  ) {
    const pagesText = await extractPdfTextPerPage(srcBytes);

    if (slug === 'pdf-to-txt' || slug === 'pdf-text-extractor') {
      const text = pagesText.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const filename = replaceExtension(file.name, 'txt');
      return {
        files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
        textOutput: text,
        outputFilename: filename,
        summaryLines: [`Extracted text across ${pagesText.length} PDF page(s)`],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }

    if (slug === 'pdf-to-html') {
      const html = `<!doctype html>\n<html><body style="font-family:sans-serif;max-width:800px;margin:2rem auto;line-height:1.6">\n${pagesText
        .map(
          (t, i) =>
            `<section><h2>Page ${i + 1}</h2>${t
              .split(/\n+/)
              .map((p) => `<p>${p.replace(/</g, '&lt;')}</p>`)
              .join('')}</section>`
        )
        .join('\n<hr />\n')}\n</body></html>`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const filename = replaceExtension(file.name, 'html');
      return {
        files: [{ blob, filename, mimeType: 'text/html', size: blob.size }],
        textOutput: html,
        outputFilename: filename,
        summaryLines: [`Converted ${pagesText.length} PDF pages to HTML`],
      };
    }

    if (slug === 'pdf-to-markdown') {
      const md = pagesText.map((t, i) => `## Page ${i + 1}\n\n${t}`).join('\n\n---\n\n');
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const filename = replaceExtension(file.name, 'md');
      return {
        files: [{ blob, filename, mimeType: 'text/markdown', size: blob.size }],
        textOutput: md,
        outputFilename: filename,
        summaryLines: [`Converted ${pagesText.length} PDF pages to Markdown`],
      };
    }

    if (slug === 'pdf-to-word') {
      const paragraphs = pagesText.flatMap((t) => t.split(/\n+/).filter(Boolean));
      const docxBytes = await createDocxBytes(paragraphs, file.name);
      const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const blob = toBinaryBlob(docxBytes, mime);
      const filename = replaceExtension(file.name, 'docx');
      return {
        files: [{ blob, filename, mimeType: mime, size: blob.size }],
        outputFilename: filename,
        outputMimeType: mime,
        summaryLines: [`Converted ${pagesText.length} PDF page(s) into editable Word (${filename})`],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }

    if (slug === 'pdf-to-excel') {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      pagesText.forEach((pageStr, idx) => {
        const rows = pageStr
          .split(/\n+/)
          .filter(Boolean)
          .map((line) => line.split(/\s{2,}|\t+/).map((c) => c.trim()));
        const ws = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [['']]);
        XLSX.utils.book_append_sheet(wb, ws, `Page_${idx + 1}`);
      });
      const xlsxOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = toBinaryBlob(xlsxOut, mime);
      const filename = replaceExtension(file.name, 'xlsx');
      return {
        files: [{ blob, filename, mimeType: mime, size: blob.size }],
        outputFilename: filename,
        outputMimeType: mime,
        summaryLines: [`Converted ${pagesText.length} PDF page(s) into ${filename}`],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }

    if (slug === 'pdf-to-powerpoint' || slug === 'pdf-to-pptx') {
      const slides = pagesText.map((t, idx) => {
        const lines = t.split(/\n+/).filter(Boolean);
        return { title: lines[0] || `Page ${idx + 1}`, lines: lines.slice(1) };
      });
      const pptxBytes = await createPptxBytes(slides);
      const mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      const blob = toBinaryBlob(pptxBytes, mime);
      const filename = replaceExtension(file.name, 'pptx');
      return {
        files: [{ blob, filename, mimeType: mime, size: blob.size }],
        outputFilename: filename,
        outputMimeType: mime,
        summaryLines: [`Converted ${slides.length} PDF pages into PowerPoint (${filename})`],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }

    if (slug === 'pdf-to-epub') {
      const epubBytes = await createEpubBytes(
        file.name.replace(/\.pdf$/i, ''),
        pagesText.map((t, idx) => ({ heading: `Page ${idx + 1}`, text: t }))
      );
      const mime = 'application/epub+zip';
      const blob = toBinaryBlob(epubBytes, mime);
      const filename = replaceExtension(file.name, 'epub');
      return {
        files: [{ blob, filename, mimeType: mime, size: blob.size }],
        outputFilename: filename,
        outputMimeType: mime,
        summaryLines: [`Packaged ${pagesText.length} PDF pages into EPUB (${filename})`],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }
  }

  if (slug === 'pdf-password-protect') {
    const userPwd = (options.pdfUserPassword ?? '').trim();
    if (!userPwd) {
      throw new Error('Please enter a password in Options above to lock this PDF.');
    }
    const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt');
    const u8 = new Uint8Array(srcBytes);
    const encryptedBytes = await encryptPDF(u8, userPwd, {
      ownerPassword: userPwd,
      algorithm: 'AES-256',
      allowPrinting: true,
      allowCopying: true,
      allowModifying: false,
    });
    const blob = toPdfBlob(encryptedBytes);
    const filename = replaceExtension(file.name, 'protected.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [
        `Encrypted "${file.name}" with PDF 2.0 AES-256 password protection`,
        `Output size: ${formatBytes(blob.size)}`,
      ],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-ocr') {
    const lang = options.ocrLang || 'eng';
    const doc = await loadPdfJsDocument(srcBytes);
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(lang);
    const pageTexts: string[] = [];

    try {
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable.');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;

        const {
          data: { text },
        } = await worker.recognize(canvas);
        pageTexts.push(`--- Page ${p} ---\n${text.trim()}`);
      }
    } finally {
      await worker.terminate();
    }

    const fullText = pageTexts.join('\n\n').trim() || '(No recognizable text detected)';
    const blob = new Blob([fullText + '\n'], { type: 'text/plain;charset=utf-8' });
    const filename = replaceExtension(file.name, 'ocr.txt');
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: fullText,
      outputFilename: filename,
      outputMimeType: 'text/plain',
      summaryLines: [
        `Recognized text across ${doc.numPages} rendered PDF page(s) (language: ${lang})`,
        `Extracted ${fullText.length.toLocaleString()} characters`,
      ],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  // Remaining pdf-lib direct document transforms
  const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: slug === 'pdf-unlock' });
  const totalPages = srcDoc.getPageCount();

  if (slug === 'pdf-unlock') {
    const cleanDoc = await PDFDocument.create();
    const copied = await cleanDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copied.forEach((p) => cleanDoc.addPage(p));
    const bytes = await cleanDoc.save();
    const blob = toPdfBlob(bytes);
    const filename = replaceExtension(file.name, 'unlocked.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Removed owner/editing permission restrictions across ${totalPages} page(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'reorder-pdf-pages') {
    const order = parseOrderedPageSequence(options.pageRange, totalPages);
    if (order.length === 0) {
      throw new Error(`Enter comma-separated page numbers between 1 and ${totalPages} (e.g. "3, 1, 2").`);
    }
    const reordered = await PDFDocument.create();
    const copied = await reordered.copyPages(srcDoc, order);
    copied.forEach((p) => reordered.addPage(p));
    const bytes = await reordered.save();
    const blob = toPdfBlob(bytes);
    const filename = replaceExtension(file.name, 'reordered.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Reordered PDF into sequence: ${order.map((i) => i + 1).join(', ')}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-signer') {
    const sigText = (options.signatureText || 'Signed Digitally').trim();
    const font = await srcDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    const mono = await srcDoc.embedFont(StandardFonts.Helvetica);
    const lastPage = srcDoc.getPages()[totalPages - 1];
    const { width } = lastPage.getSize();
    const dateStr = new Date().toISOString().split('T')[0];

    lastPage.drawRectangle({
      x: Math.max(40, width - 250),
      y: 44,
      width: 205,
      height: 54,
      borderColor: rgb(0.31, 0.27, 0.9),
      borderWidth: 1.5,
      color: rgb(0.97, 0.98, 1),
    });
    lastPage.drawText(sigText.slice(0, 26), {
      x: Math.max(50, width - 238),
      y: 72,
      size: 14,
      font,
      color: rgb(0.18, 0.16, 0.65),
    });
    lastPage.drawText(`Date: ${dateStr}`, {
      x: Math.max(50, width - 238),
      y: 54,
      size: 9,
      font: mono,
      color: rgb(0.35, 0.4, 0.5),
    });

    const bytes = await srcDoc.save();
    const blob = toPdfBlob(bytes);
    const filename = replaceExtension(file.name, 'signed.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Stamped signature "${sigText}" onto page ${totalPages}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-form-filler') {
    const form = srcDoc.getForm();
    const fields = form.getFields();
    if (fields.length === 0) {
      throw new Error('This PDF does not contain fillable AcroForm fields.');
    }
    const entries = new Map<string, string>();
    for (const line of (options.formValues || '').split(/\r?\n/)) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        entries.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
      }
    }

    let filledCount = 0;
    const fieldNames: string[] = [];
    for (const field of fields) {
      const name = field.getName();
      fieldNames.push(name);
      const val = entries.get(name);
      if (val !== undefined) {
        try {
          const tf = form.getTextField(name);
          tf.setText(val);
          filledCount++;
        } catch {
          try {
            const cb = form.getCheckBox(name);
            if (val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes') cb.check();
            else cb.uncheck();
            filledCount++;
          } catch {
            // Non-text/checkbox field skipped cleanly
          }
        }
      }
    }

    const bytes = await srcDoc.save();
    const blob = toPdfBlob(bytes);
    const filename = replaceExtension(file.name, 'filled.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      textOutput: `Detected ${fields.length} form field(s):\n${fieldNames.map((n) => `${n}=${entries.get(n) ?? ''}`).join('\n')}`,
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Detected ${fields.length} AcroForm field(s); updated ${filledCount} field(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'rotate-pdf-pages') {
    const angle = options.rotation ?? 90;
    for (const page of srcDoc.getPages()) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }
    const pdfBytes = await srcDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'rotated.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Rotated all ${totalPages} pages by ${angle}°`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'split-pdf') {
    const outputFiles: ProcessOutputFile[] = [];
    for (let i = 0; i < totalPages; i++) {
      const singleDoc = await PDFDocument.create();
      const [copied] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copied);
      const bytes = await singleDoc.save();
      const blob = toPdfBlob(bytes);
      outputFiles.push({
        blob,
        filename: replaceExtension(file.name, `page-${i + 1}.pdf`),
        mimeType: 'application/pdf',
        size: blob.size,
      });
    }
    const totalOut = outputFiles.reduce((acc, f) => acc + f.size, 0);
    return {
      files: outputFiles,
      outputFilename: outputFiles[0]?.filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Split ${totalPages}-page PDF into ${outputFiles.length} standalone PDF file(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: totalOut,
    };
  }

  if (slug === 'extract-pdf-pages') {
    const indices = parsePageRangeIndices(options.pageRange || '1', totalPages);
    if (indices.length === 0) {
      throw new Error(`No valid page numbers found. Enter pages between 1 and ${totalPages} (e.g. "1, 3-5").`);
    }
    const extractedDoc = await PDFDocument.create();
    const copied = await extractedDoc.copyPages(srcDoc, indices);
    copied.forEach((p) => extractedDoc.addPage(p));
    const pdfBytes = await extractedDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'extracted.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [
        `Extracted ${indices.length} page(s) (${indices.map((i) => i + 1).join(', ')}) out of ${totalPages}`,
      ],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'delete-pdf-pages') {
    const toDelete = new Set(parsePageRangeIndices(options.pageRange || '1', totalPages));
    if (toDelete.size === 0) {
      throw new Error(`No valid page numbers found to delete. Enter pages between 1 and ${totalPages}.`);
    }
    const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter((i) => !toDelete.has(i));
    if (keepIndices.length === 0) {
      throw new Error('Cannot delete every page in the PDF. At least one page must remain.');
    }
    const trimmedDoc = await PDFDocument.create();
    const copied = await trimmedDoc.copyPages(srcDoc, keepIndices);
    copied.forEach((p) => trimmedDoc.addPage(p));
    const pdfBytes = await trimmedDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'trimmed.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Deleted ${toDelete.size} page(s); ${keepIndices.length} page(s) kept`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-watermark') {
    const font = await srcDoc.embedFont(StandardFonts.HelveticaBold);
    const text = (options.watermarkText ?? 'CONFIDENTIAL').trim() || 'CONFIDENTIAL';
    const opacity = Math.min(0.85, Math.max(0.1, (options.watermarkOpacity ?? 35) / 100));
    const pages = srcDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      const size = Math.max(24, Math.min(64, Math.round(width / 10)));
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: Math.max(20, (width - textWidth * 0.7) / 2),
        y: height / 2,
        size,
        font,
        color: rgb(0.31, 0.27, 0.9),
        opacity,
        rotate: degrees(35),
      });
    }
    const pdfBytes = await srcDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'watermarked.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Stamped "${text}" watermark on all ${pages.length} page(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-metadata-editor') {
    if (options.pdfTitle?.trim()) srcDoc.setTitle(options.pdfTitle.trim());
    if (options.pdfAuthor?.trim()) srcDoc.setAuthor(options.pdfAuthor.trim());
    if (options.pdfSubject?.trim()) srcDoc.setSubject(options.pdfSubject.trim());
    srcDoc.setProducer('NexcTool Local PDF Engine');
    const pdfBytes = await srcDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'updated-meta.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [
        `Updated PDF metadata (${totalPages} pages)`,
        `Title: ${options.pdfTitle?.trim() || srcDoc.getTitle() || 'Unchanged'} · Author: ${options.pdfAuthor?.trim() || srcDoc.getAuthor() || 'Unchanged'}`,
      ],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'pdf-page-numbers') {
    const font = await srcDoc.embedFont(StandardFonts.Helvetica);
    const pages = srcDoc.getPages();
    const total = pages.length;
    pages.forEach((page, index) => {
      const { width } = page.getSize();
      const label = `Page ${index + 1} of ${total}`;
      const textWidth = font.widthOfTextAtSize(label, 10);
      page.drawText(label, {
        x: (width - textWidth) / 2,
        y: 20,
        size: 10,
        font,
        color: rgb(0.3, 0.35, 0.45),
      });
    });
    const pdfBytes = await srcDoc.save();
    const blob = toPdfBlob(pdfBytes);
    const filename = replaceExtension(file.name, 'numbered.pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Added page numbers to all ${total} pages`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  throw new Error(`PDF operation "${slug}" is not configured yet.`);
}
