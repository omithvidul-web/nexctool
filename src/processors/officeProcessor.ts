import JSZip from 'jszip';
import type { ProcessOptions, ProcessOutputFile, ProcessResult } from './types';
import { formatBytes, replaceExtension } from '../utils/formatters';
import {
  createDocxBytes,
  createEpubBytes,
  createOdtBytes,
  createPptxBytes,
  extractDocxParagraphs,
  extractEpubText,
  extractOdtParagraphs,
  extractPptxSlides,
  plainTextToRtf,
  rtfToPlainText,
} from '../utils/ooxmlHelper';

function toBinaryBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType });
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ODT_MIME = 'application/vnd.oasis.opendocument.text';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const ODP_MIME = 'application/vnd.oasis.opendocument.presentation';

function htmlToLines(html: string): string[] {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|h[1-6]|li|div|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function markdownToLines(md: string): string[] {
  return md
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim()
    )
    .filter(Boolean);
}

async function extractAnyDocLines(file: File): Promise<{ lines: string[]; kind: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    return { lines: await extractDocxParagraphs(await file.arrayBuffer()), kind: 'DOCX' };
  }
  if (name.endsWith('.odt')) {
    return { lines: await extractOdtParagraphs(await file.arrayBuffer()), kind: 'ODT' };
  }
  if (name.endsWith('.rtf')) {
    return { lines: rtfToPlainText(await file.text()).split(/\n+/).filter(Boolean), kind: 'RTF' };
  }
  if (name.endsWith('.epub')) {
    const chaps = await extractEpubText(await file.arrayBuffer());
    return { lines: chaps.flatMap((c) => c.split(/\n+/)).filter(Boolean), kind: 'EPUB' };
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return { lines: htmlToLines(await file.text()), kind: 'HTML' };
  }
  const text = await file.text();
  return { lines: text.replace(/\r\n/g, '\n').split(/\n+/).filter(Boolean), kind: 'Text/Markdown' };
}

async function renderLinesToPdf(lines: string[], title?: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 612;
  const pageH = 792;
  const margin = 50;
  const maxWidth = pageW - margin * 2;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  if (title) {
    page.drawText(title, { x: margin, y, size: 16, font: boldFont, color: rgb(0.08, 0.12, 0.22) });
    y -= 26;
  }

  for (const para of lines) {
    const words = para.split(/\s+/);
    let current = '';
    const wrapped: string[] = [];
    for (const w of words) {
      const cand = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(cand, 11) <= maxWidth) {
        current = cand;
      } else {
        if (current) wrapped.push(current);
        current = w;
      }
    }
    if (current) wrapped.push(current);

    for (const line of wrapped) {
      if (y < margin) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.1, 0.14, 0.22) });
      y -= 16;
    }
    y -= 6;
  }

  return pdfDoc.save();
}

async function renderSlideToCanvas(
  slide: { index: number; title: string; lines: string[] },
  totalSlides: number,
  mime: 'image/png' | 'image/jpeg'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const grad = ctx.createLinearGradient(0, 0, 1280, 720);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#1E1B4B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Accent bar
  ctx.fillStyle = '#6366F1';
  ctx.fillRect(72, 72, 10, 88);

  // Slide Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 42px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(slide.title.slice(0, 56), 104, 128);

  // Body lines
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 26px "Plus Jakarta Sans", system-ui, sans-serif';
  let y = 220;
  for (const line of slide.lines.slice(0, 10)) {
    const clean = `• ${line.slice(0, 82)}`;
    ctx.fillText(clean, 84, y);
    y += 44;
  }

  // Footer
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(`Slide ${slide.index} / ${totalSlides}`, 1100, 675);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to render slide image.'))),
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined
    );
  });
}

export async function processOfficeTool(
  slug: string,
  files: File[],
  textInput: string,
  options: ProcessOptions
): Promise<ProcessResult> {
  // Text-or-file generators -> DOCX
  if (slug === 'txt-to-docx' || slug === 'html-to-docx' || slug === 'markdown-to-docx') {
    const file = files[0];
    const raw = file && !textInput.trim() ? await file.text() : textInput;
    if (!raw.trim()) throw new Error('Please upload a file or enter text to convert.');
    const lines =
      slug === 'html-to-docx'
        ? htmlToLines(raw)
        : slug === 'markdown-to-docx'
          ? markdownToLines(raw)
          : raw.replace(/\r\n/g, '\n').split(/\n+/).filter(Boolean);
    const bytes = await createDocxBytes(lines, file?.name || 'NexcTool Document');
    const blob = toBinaryBlob(bytes, DOCX_MIME);
    const filename = replaceExtension(file?.name || 'document.txt', 'docx');
    return {
      files: [{ blob, filename, mimeType: DOCX_MIME, size: blob.size }],
      outputFilename: filename,
      outputMimeType: DOCX_MIME,
      summaryLines: [`Created ${filename} with ${lines.length} paragraph(s)`],
      originalTotalBytes: file?.size ?? new Blob([raw]).size,
      outputTotalBytes: blob.size,
    };
  }

  if (files.length === 0) {
    throw new Error('Please select a file first.');
  }

  // Multi-file Document & Presentation tools
  if (slug === 'docx-merger') {
    if (files.length < 2) throw new Error('Select at least 2 DOCX files to merge.');
    const allParas: string[] = [];
    let totalOrig = 0;
    for (const f of files) {
      totalOrig += f.size;
      const paras = await extractDocxParagraphs(await f.arrayBuffer());
      allParas.push(...paras);
    }
    const bytes = await createDocxBytes(allParas, 'Merged Document');
    const blob = toBinaryBlob(bytes, DOCX_MIME);
    return {
      files: [{ blob, filename: 'merged-document.docx', mimeType: DOCX_MIME, size: blob.size }],
      outputFilename: 'merged-document.docx',
      outputMimeType: DOCX_MIME,
      summaryLines: [`Merged ${files.length} DOCX files (${allParas.length} total paragraphs)`],
      originalTotalBytes: totalOrig,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'document-compare') {
    if (files.length < 2) throw new Error('Select 2 documents to compare.');
    const [a, b] = await Promise.all([extractAnyDocLines(files[0]), extractAnyDocLines(files[1])]);
    const setA = new Set(a.lines);
    const setB = new Set(b.lines);
    const added = b.lines.filter((l) => !setA.has(l));
    const removed = a.lines.filter((l) => !setB.has(l));
    const report = [
      `Comparing "${files[0].name}" (${a.lines.length} lines) vs "${files[1].name}" (${b.lines.length} lines)`,
      `Removed lines: ${removed.length} · Added lines: ${added.length}`,
      '',
      ...removed.map((l) => `- ${l}`),
      ...added.map((l) => `+ ${l}`),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: 'document-diff.txt', mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: 'document-diff.txt',
      summaryLines: [`Compared ${files[0].name} and ${files[1].name}: ${added.length} added, ${removed.length} removed`],
    };
  }

  if (slug === 'pptx-merger') {
    if (files.length < 2) throw new Error('Select at least 2 PPTX presentations to merge.');
    const allSlides: { title: string; lines: string[] }[] = [];
    let totalOrig = 0;
    for (const f of files) {
      totalOrig += f.size;
      const slides = await extractPptxSlides(await f.arrayBuffer());
      allSlides.push(...slides.map((s) => ({ title: s.title, lines: s.lines })));
    }
    const bytes = await createPptxBytes(allSlides);
    const blob = toBinaryBlob(bytes, PPTX_MIME);
    return {
      files: [{ blob, filename: 'merged-presentation.pptx', mimeType: PPTX_MIME, size: blob.size }],
      outputFilename: 'merged-presentation.pptx',
      outputMimeType: PPTX_MIME,
      summaryLines: [`Merged ${files.length} decks into ${allSlides.length} slides`],
      originalTotalBytes: totalOrig,
      outputTotalBytes: blob.size,
    };
  }

  const file = files[0];

  // Single-file Document tools
  if (slug === 'docx-to-txt') {
    const paras = await extractDocxParagraphs(await file.arrayBuffer());
    const text = paras.join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = replaceExtension(file.name, 'txt');
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: text,
      outputFilename: filename,
      summaryLines: [`Extracted ${paras.length} paragraphs from DOCX`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'docx-to-html') {
    const paras = await extractDocxParagraphs(await file.arrayBuffer());
    const html = `<!doctype html>\n<html><body>\n${paras.map((p) => `  <p>${p.replace(/</g, '&lt;')}</p>`).join('\n')}\n</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const filename = replaceExtension(file.name, 'html');
    return {
      files: [{ blob, filename, mimeType: 'text/html', size: blob.size }],
      textOutput: html,
      outputFilename: filename,
      summaryLines: [`Converted ${paras.length} DOCX paragraphs to HTML`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'docx-to-rtf') {
    const paras = await extractDocxParagraphs(await file.arrayBuffer());
    const rtf = plainTextToRtf(paras);
    const blob = new Blob([rtf], { type: 'application/rtf;charset=utf-8' });
    const filename = replaceExtension(file.name, 'rtf');
    return {
      files: [{ blob, filename, mimeType: 'application/rtf', size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Converted DOCX (${paras.length} paragraphs) to RTF`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'docx-to-odt') {
    const paras = await extractDocxParagraphs(await file.arrayBuffer());
    const bytes = await createOdtBytes(paras);
    const blob = toBinaryBlob(bytes, ODT_MIME);
    const filename = replaceExtension(file.name, 'odt');
    return {
      files: [{ blob, filename, mimeType: ODT_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Converted ${paras.length} paragraphs from DOCX to ODT`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'odt-to-docx') {
    const paras = await extractOdtParagraphs(await file.arrayBuffer());
    const bytes = await createDocxBytes(paras, file.name);
    const blob = toBinaryBlob(bytes, DOCX_MIME);
    const filename = replaceExtension(file.name, 'docx');
    return {
      files: [{ blob, filename, mimeType: DOCX_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Converted ${paras.length} paragraphs from ODT to DOCX`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'rtf-to-docx') {
    const lines = rtfToPlainText(await file.text()).split(/\n+/).filter(Boolean);
    const bytes = await createDocxBytes(lines, file.name);
    const blob = toBinaryBlob(bytes, DOCX_MIME);
    const filename = replaceExtension(file.name, 'docx');
    return {
      files: [{ blob, filename, mimeType: DOCX_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Converted RTF (${lines.length} paragraphs) to DOCX`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'rtf-to-pdf' || slug === 'epub-to-pdf') {
    const { lines } = await extractAnyDocLines(file);
    const pdfBytes = await renderLinesToPdf(lines, file.name.replace(/\.[^.]+$/, ''));
    const blob = toBinaryBlob(pdfBytes, 'application/pdf');
    const filename = replaceExtension(file.name, 'pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Rendered ${lines.length} paragraph(s) into ${filename}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'epub-to-txt') {
    const chapters = await extractEpubText(await file.arrayBuffer());
    const text = chapters.join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = replaceExtension(file.name, 'txt');
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: text.slice(0, 20000),
      outputFilename: filename,
      summaryLines: [`Extracted ${chapters.length} chapter(s) from EPUB`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'docx-splitter') {
    const paras = await extractDocxParagraphs(await file.arrayBuffer());
    const chunkSize = Math.max(1, Math.ceil(paras.length / Math.min(10, Math.max(2, Math.ceil(paras.length / 10)))));
    const outFiles: ProcessOutputFile[] = [];
    for (let i = 0; i < paras.length; i += chunkSize) {
      const partBytes = await createDocxBytes(paras.slice(i, i + chunkSize), `${file.name} Part ${outFiles.length + 1}`);
      const blob = toBinaryBlob(partBytes, DOCX_MIME);
      outFiles.push({
        blob,
        filename: replaceExtension(file.name, `part-${outFiles.length + 1}.docx`),
        mimeType: DOCX_MIME,
        size: blob.size,
      });
    }
    return {
      files: outFiles,
      outputFilename: outFiles[0]?.filename,
      summaryLines: [`Split ${paras.length} paragraphs into ${outFiles.length} DOCX files`],
      originalTotalBytes: file.size,
      outputTotalBytes: outFiles.reduce((a, f) => a + f.size, 0),
    };
  }

  if (slug === 'document-text-extractor') {
    const { lines, kind } = await extractAnyDocLines(file);
    const text = lines.join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = replaceExtension(file.name, 'extracted.txt');
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: text.slice(0, 20000),
      outputFilename: filename,
      summaryLines: [`Extracted ${lines.length} text block(s) from ${kind}`],
    };
  }

  if (slug === 'document-page-counter' || slug === 'document-metadata-viewer') {
    const { lines, kind } = await extractAnyDocLines(file);
    const fullText = lines.join('\n');
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
    const estPages = Math.max(1, Math.ceil(words / 275));
    const report = [
      `Document: ${file.name}`,
      `Format: ${kind}`,
      `File Size: ${formatBytes(file.size)}`,
      `Paragraphs: ${lines.length}`,
      `Words: ${words.toLocaleString()}`,
      `Estimated Pages (~275 words/page): ${estPages}`,
      `Last Modified: ${new Date(file.lastModified).toISOString()}`,
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: replaceExtension(file.name, 'report.txt'), mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: replaceExtension(file.name, 'report.txt'),
      summaryLines: [`${estPages} estimated page(s) · ${words} words · ${lines.length} paragraphs`],
    };
  }

  if (slug === 'document-watermark') {
    const { lines } = await extractAnyDocLines(file);
    const wm = (options.documentWatermark || options.watermarkText || 'CONFIDENTIAL').trim();
    const watermarked = [`[WATERMARK: ${wm}]`, ...lines, `[WATERMARK: ${wm}]`];
    const bytes = await createDocxBytes(watermarked, file.name);
    const blob = toBinaryBlob(bytes, DOCX_MIME);
    const filename = replaceExtension(file.name, 'watermarked.docx');
    return {
      files: [{ blob, filename, mimeType: DOCX_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Stamped "${wm}" watermark into ${filename}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  // Presentation Tools
  if (slug === 'odp-to-pptx') {
    const paras = await extractOdtParagraphs(await file.arrayBuffer());
    const slides = paras.length > 0
      ? [{ title: paras[0], lines: paras.slice(1) }]
      : [{ title: file.name, lines: ['Converted from ODP'] }];
    const bytes = await createPptxBytes(slides);
    const blob = toBinaryBlob(bytes, PPTX_MIME);
    const filename = replaceExtension(file.name, 'pptx');
    return {
      files: [{ blob, filename, mimeType: PPTX_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Converted ODP content to ${filename}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'presentation-compressor') {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const bytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    const blob = toBinaryBlob(bytes, PPTX_MIME);
    const filename = replaceExtension(file.name, 'compressed.pptx');
    return {
      files: [{ blob, filename, mimeType: PPTX_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Recompressed presentation: ${formatBytes(file.size)} → ${formatBytes(blob.size)}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'slide-image-extractor') {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const media = Object.values(zip.files).filter(
      (f) => !f.dir && /^ppt\/media\//i.test(f.name)
    );
    if (media.length === 0) {
      throw new Error('No embedded images were found inside ppt/media/ in this presentation.');
    }
    const outFiles: ProcessOutputFile[] = [];
    for (const entry of media) {
      const u8 = await entry.async('uint8array');
      const short = entry.name.split('/').pop() || 'slide-image.bin';
      const mime = short.endsWith('.png') ? 'image/png' : short.endsWith('.jpg') || short.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream';
      const blob = toBinaryBlob(u8, mime);
      outFiles.push({ blob, filename: short, mimeType: mime, size: blob.size });
    }
    return {
      files: outFiles,
      outputFilename: outFiles[0]?.filename,
      summaryLines: [`Extracted ${outFiles.length} embedded media image(s) from presentation`],
      originalTotalBytes: file.size,
      outputTotalBytes: outFiles.reduce((a, f) => a + f.size, 0),
    };
  }

  const slides = await extractPptxSlides(await file.arrayBuffer());

  if (slug === 'pptx-to-txt' || slug === 'presentation-text-extractor') {
    const text = slides
      .map((s) => `--- Slide ${s.index}: ${s.title} ---\n${s.lines.join('\n')}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = replaceExtension(file.name, 'txt');
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: text,
      outputFilename: filename,
      summaryLines: [`Extracted text from ${slides.length} slide(s)`],
    };
  }

  if (slug === 'pptx-to-html') {
    const html = `<!doctype html>\n<html><body style="font-family:sans-serif;max-width:860px;margin:2rem auto">\n${slides
      .map(
        (s) =>
          `<section style="padding:24px;margin-bottom:24px;border:1px solid #cbd5e1;border-radius:12px"><h2>Slide ${s.index}: ${s.title.replace(/</g, '&lt;')}</h2><ul>${s.lines
            .map((l) => `<li>${l.replace(/</g, '&lt;')}</li>`)
            .join('')}</ul></section>`
      )
      .join('\n')}\n</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const filename = replaceExtension(file.name, 'html');
    return {
      files: [{ blob, filename, mimeType: 'text/html', size: blob.size }],
      textOutput: html,
      outputFilename: filename,
      summaryLines: [`Converted ${slides.length} slides to HTML`],
    };
  }

  if (slug === 'pptx-to-odp') {
    const allLines = slides.flatMap((s) => [`Slide ${s.index}: ${s.title}`, ...s.lines]);
    const bytes = await createOdtBytes(allLines);
    const blob = toBinaryBlob(bytes, ODP_MIME);
    const filename = replaceExtension(file.name, 'odp');
    return {
      files: [{ blob, filename, mimeType: ODP_MIME, size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Converted ${slides.length} slide(s) to OpenDocument Presentation (.odp)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'presentation-metadata-viewer') {
    const totalWords = slides.reduce((a, s) => a + [s.title, ...s.lines].join(' ').split(/\s+/).filter(Boolean).length, 0);
    const report = [
      `Presentation: ${file.name}`,
      `Total Slides: ${slides.length}`,
      `Total Words: ${totalWords}`,
      `File Size: ${formatBytes(file.size)}`,
      '',
      ...slides.map((s) => `Slide ${s.index}: ${s.title} (${s.lines.length} bullet lines)`),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: replaceExtension(file.name, 'metadata.txt'), mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: replaceExtension(file.name, 'metadata.txt'),
      summaryLines: [`${slides.length} slides · ${totalWords} total words`],
    };
  }

  if (slug === 'pptx-splitter' || slug === 'slide-extractor') {
    const outFiles: ProcessOutputFile[] = [];
    for (const s of slides) {
      const bytes = await createPptxBytes([{ title: s.title, lines: s.lines }]);
      const blob = toBinaryBlob(bytes, PPTX_MIME);
      outFiles.push({
        blob,
        filename: replaceExtension(file.name, `slide-${s.index}.pptx`),
        mimeType: PPTX_MIME,
        size: blob.size,
      });
    }
    return {
      files: outFiles,
      outputFilename: outFiles[0]?.filename,
      summaryLines: [`Extracted ${slides.length} individual slide .pptx file(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: outFiles.reduce((a, f) => a + f.size, 0),
    };
  }

  if (slug === 'pptx-to-png' || slug === 'pptx-to-jpg') {
    const isJpg = slug === 'pptx-to-jpg';
    const mime = isJpg ? 'image/jpeg' : 'image/png';
    const ext = isJpg ? 'jpg' : 'png';
    const outFiles: ProcessOutputFile[] = [];
    let firstPreview: string | undefined;

    for (const s of slides) {
      const blob = await renderSlideToCanvas(s, slides.length, mime);
      if (!firstPreview) {
        firstPreview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
      }
      outFiles.push({
        blob,
        filename: replaceExtension(file.name, `slide-${s.index}.${ext}`),
        mimeType: mime,
        size: blob.size,
      });
    }
    return {
      files: outFiles,
      outputFilename: outFiles[0]?.filename,
      outputMimeType: mime,
      previewDataUrl: firstPreview,
      summaryLines: [`Rendered ${slides.length} presentation slide(s) as ${ext.toUpperCase()} images`],
      originalTotalBytes: file.size,
      outputTotalBytes: outFiles.reduce((a, f) => a + f.size, 0),
    };
  }

  if (slug === 'pptx-to-pdf' || slug === 'powerpoint-to-pdf') {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const body = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const s of slides) {
      const page = pdfDoc.addPage([960, 540]);
      page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.06, 0.09, 0.17) });
      page.drawText(s.title.slice(0, 72), { x: 56, y: 450, size: 26, font: bold, color: rgb(1, 1, 1) });
      let y = 390;
      for (const l of s.lines.slice(0, 12)) {
        page.drawText(`• ${l.slice(0, 90)}`, { x: 60, y, size: 15, font: body, color: rgb(0.8, 0.85, 0.94) });
        y -= 28;
      }
      page.drawText(`Slide ${s.index} / ${slides.length}`, { x: 840, y: 28, size: 11, font: body, color: rgb(0.58, 0.64, 0.72) });
    }
    const bytes = await pdfDoc.save();
    const blob = toBinaryBlob(bytes, 'application/pdf');
    const filename = replaceExtension(file.name, 'pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Converted ${slides.length} presentation slides into PDF`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  throw new Error(`Office tool "${slug}" is not configured.`);
}
