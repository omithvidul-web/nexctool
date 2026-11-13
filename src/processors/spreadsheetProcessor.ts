import type { ProcessOutputFile, ProcessResult } from './types';
import { formatBytes, replaceExtension } from '../utils/formatters';

function toBinaryBlob(data: ArrayBuffer | Uint8Array, mimeType: string): Blob {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType });
}

export async function processSpreadsheetTool(
  slug: string,
  files: File[],
  textInput: string
): Promise<ProcessResult> {
  const XLSX = await import('xlsx');

  if (slug === 'csv-to-xlsx') {
    const file = files[0];
    const csvText = file && !textInput.trim() ? await file.text() : textInput;
    if (!csvText.trim()) throw new Error('Please upload a CSV file or paste CSV data first.');
    const wb = XLSX.read(csvText, { type: 'string' });
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = toBinaryBlob(out, mime);
    const filename = replaceExtension(file?.name || 'spreadsheet.csv', 'xlsx');
    return {
      files: [{ blob, filename, mimeType: mime, size: blob.size }],
      outputFilename: filename,
      outputMimeType: mime,
      summaryLines: [`Converted CSV (${wb.SheetNames.length} sheet) to XLSX (${formatBytes(blob.size)})`],
      originalTotalBytes: file?.size ?? new Blob([csvText]).size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'json-to-xlsx') {
    const file = files[0];
    const jsonText = file && !textInput.trim() ? await file.text() : textInput;
    if (!jsonText.trim()) throw new Error('Please upload a JSON file or paste JSON array data first.');
    const parsed = JSON.parse(jsonText);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const ws = XLSX.utils.json_to_sheet(arr);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = toBinaryBlob(out, mime);
    const filename = replaceExtension(file?.name || 'data.json', 'xlsx');
    return {
      files: [{ blob, filename, mimeType: mime, size: blob.size }],
      outputFilename: filename,
      outputMimeType: mime,
      summaryLines: [`Converted ${arr.length} JSON record(s) into ${filename}`],
      originalTotalBytes: file?.size ?? new Blob([jsonText]).size,
      outputTotalBytes: blob.size,
    };
  }

  if (files.length === 0) {
    throw new Error('Please select a spreadsheet file first.');
  }

  if (slug === 'excel-sheet-merger') {
    if (files.length < 2) {
      throw new Error('Please select at least 2 Excel spreadsheets to merge.');
    }
    const mergedWb = XLSX.utils.book_new();
    let totalOriginal = 0;
    const usedNames = new Set<string>();
    let totalSheets = 0;

    for (const f of files) {
      totalOriginal += f.size;
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      for (const sheetName of wb.SheetNames) {
        let candidate = sheetName.slice(0, 28) || 'Sheet';
        let counter = 2;
        while (usedNames.has(candidate)) {
          candidate = `${sheetName.slice(0, 24)}_${counter++}`;
        }
        usedNames.add(candidate);
        XLSX.utils.book_append_sheet(mergedWb, wb.Sheets[sheetName], candidate);
        totalSheets++;
      }
    }

    const out = XLSX.write(mergedWb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = toBinaryBlob(out, mime);
    return {
      files: [{ blob, filename: 'merged-workbook.xlsx', mimeType: mime, size: blob.size }],
      outputFilename: 'merged-workbook.xlsx',
      outputMimeType: mime,
      summaryLines: [`Merged ${files.length} files (${totalSheets} sheets) into merged-workbook.xlsx`],
      originalTotalBytes: totalOriginal,
      outputTotalBytes: blob.size,
    };
  }

  const file = files[0];
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('This workbook contains no worksheets.');
  }
  const firstSheet = workbook.Sheets[firstSheetName];

  if (slug === 'xlsx-to-csv') {
    const csv = XLSX.utils.sheet_to_csv(firstSheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const filename = replaceExtension(file.name, 'csv');
    return {
      files: [{ blob, filename, mimeType: 'text/csv', size: blob.size }],
      textOutput: csv.slice(0, 15000),
      outputFilename: filename,
      outputMimeType: 'text/csv',
      summaryLines: [`Exported sheet "${firstSheetName}" to CSV`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'xlsx-to-html') {
    const html = XLSX.utils.sheet_to_html(firstSheet);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const filename = replaceExtension(file.name, 'html');
    return {
      files: [{ blob, filename, mimeType: 'text/html', size: blob.size }],
      textOutput: html.slice(0, 15000),
      outputFilename: filename,
      outputMimeType: 'text/html',
      summaryLines: [`Converted sheet "${firstSheetName}" to clean HTML table`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'xlsx-to-json') {
    const rows = XLSX.utils.sheet_to_json(firstSheet);
    const json = JSON.stringify(rows, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const filename = replaceExtension(file.name, 'json');
    return {
      files: [{ blob, filename, mimeType: 'application/json', size: blob.size }],
      textOutput: json.slice(0, 15000),
      outputFilename: filename,
      outputMimeType: 'application/json',
      summaryLines: [`Converted ${rows.length} rows from "${firstSheetName}" to JSON`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'xls-to-xlsx' || slug === 'ods-to-xlsx') {
    const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = toBinaryBlob(out, mime);
    const filename = replaceExtension(file.name, 'xlsx');
    return {
      files: [{ blob, filename, mimeType: mime, size: blob.size }],
      outputFilename: filename,
      outputMimeType: mime,
      summaryLines: [`Converted ${workbook.SheetNames.length} sheet(s) to modern .xlsx format`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'xlsx-to-ods') {
    const out = XLSX.write(workbook, { bookType: 'ods', type: 'array' }) as ArrayBuffer;
    const mime = 'application/vnd.oasis.opendocument.spreadsheet';
    const blob = toBinaryBlob(out, mime);
    const filename = replaceExtension(file.name, 'ods');
    return {
      files: [{ blob, filename, mimeType: mime, size: blob.size }],
      outputFilename: filename,
      outputMimeType: mime,
      summaryLines: [`Converted ${workbook.SheetNames.length} sheet(s) to OpenDocument (.ods)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'excel-sheet-splitter') {
    const outFiles: ProcessOutputFile[] = [];
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    for (const sheetName of workbook.SheetNames) {
      const subWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(subWb, workbook.Sheets[sheetName], sheetName);
      const out = XLSX.write(subWb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const blob = toBinaryBlob(out, mime);
      const safeSheet = sheetName.replace(/[^a-zA-Z0-9_-]+/g, '-');
      outFiles.push({
        blob,
        filename: replaceExtension(file.name, `${safeSheet}.xlsx`),
        mimeType: mime,
        size: blob.size,
      });
    }
    const totalOut = outFiles.reduce((acc, f) => acc + f.size, 0);
    return {
      files: outFiles,
      outputFilename: outFiles[0]?.filename,
      outputMimeType: mime,
      summaryLines: [`Split workbook into ${outFiles.length} standalone .xlsx sheet file(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: totalOut,
    };
  }

  if (slug === 'xlsx-to-pdf' || slug === 'excel-to-pdf') {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Courier);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageW = 792;
    const pageH = 612; // Landscape
    const margin = 40;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;
      page.drawText(`Sheet: ${sheetName}`, {
        x: margin,
        y,
        size: 13,
        font: boldFont,
        color: rgb(0.1, 0.15, 0.25),
      });
      y -= 22;

      for (const row of rows) {
        if (y < margin) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        const line = (Array.isArray(row) ? row : [])
          .map((cell) => String(cell ?? '').replace(/\s+/g, ' ').slice(0, 28))
          .join(' | ')
          .slice(0, 125);
        if (line.trim()) {
          page.drawText(line, {
            x: margin,
            y,
            size: 9,
            font: bodyFont,
            color: rgb(0.12, 0.16, 0.24),
          });
        }
        y -= 13;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = toBinaryBlob(pdfBytes, 'application/pdf');
    const filename = replaceExtension(file.name, 'pdf');
    return {
      files: [{ blob, filename, mimeType: 'application/pdf', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/pdf',
      summaryLines: [`Rendered ${workbook.SheetNames.length} worksheet(s) into ${pdfDoc.getPageCount()} PDF page(s)`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'spreadsheet-formula-checker') {
    const formulaLines: string[] = [];
    const errorLines: string[] = [];
    const errorTokens = ['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#N/A', '#NUM!', '#NULL!'];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      for (const [addr, cell] of Object.entries(sheet)) {
        if (addr.startsWith('!') || !cell || typeof cell !== 'object') continue;
        const c = cell as { f?: string; w?: string; v?: unknown; t?: string };
        if (c.f) {
          formulaLines.push(`[${sheetName}!${addr}] =${c.f} → ${c.w ?? String(c.v ?? '')}`);
        }
        const strVal = String(c.w ?? c.v ?? '');
        if (c.t === 'e' || errorTokens.some((tok) => strVal.includes(tok))) {
          errorLines.push(`ERROR at ${sheetName}!${addr}: ${strVal}${c.f ? ` (formula: =${c.f})` : ''}`);
        }
      }
    }

    const report = [
      `Workbook: ${file.name} (${workbook.SheetNames.length} sheets)`,
      `Formulas found: ${formulaLines.length}`,
      `Formula errors found: ${errorLines.length}`,
      '',
      ...(errorLines.length > 0 ? ['--- ERRORS ---', ...errorLines, ''] : ['No formula errors (#REF!, #DIV/0!, #VALUE!, #NAME?) detected.']),
      ...(formulaLines.length > 0 ? ['', '--- FORMULAS ---', ...formulaLines.slice(0, 200)] : []),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const filename = replaceExtension(file.name, 'formula-audit.txt');
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: filename,
      summaryLines: [`Scanned ${workbook.SheetNames.length} sheets: ${formulaLines.length} formulas, ${errorLines.length} error(s)`],
    };
  }

  throw new Error(`Spreadsheet tool "${slug}" is not configured.`);
}
