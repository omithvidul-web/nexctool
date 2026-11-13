import type { ProcessOptions, ProcessOutputFile, ProcessResult } from './types';
import { calculateSavingsPercent, formatBytes, replaceExtension } from '../utils/formatters';
import { md5Bytes, md5Text } from '../utils/md5';
import { createZipBlob, extractZipEntries } from '../utils/zipHelper';
import { createTarArchive, extractTarArchive } from '../utils/tarHelper';

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toCopyBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType });
}

function detectMagicType(bytes: Uint8Array, filename: string): string {
  const hex = Array.from(bytes.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'JPEG Image (image/jpeg)';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'PNG Image (image/png)';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'GIF Image (image/gif)';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'PDF Document (application/pdf)';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'ZIP / Office OpenXML Archive (application/zip)';
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'GZIP Compressed Archive (application/gzip)';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'RIFF Container (WebP / WAV / AVI)';
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'MP3 Audio with ID3 Tag (audio/mpeg)';
  return `Binary / Plain Data (${filename.split('.').pop()?.toUpperCase() || 'Unknown'}) · Header: ${hex}`;
}

export async function processUtilityTool(
  slug: string,
  files: File[],
  textInput: string,
  options: ProcessOptions
): Promise<ProcessResult> {
  if (slug === 'file-size-converter') {
    const file = files[0];
    let bytes = 0;
    if (file) {
      bytes = file.size;
    } else {
      const val = Number(options.sizeValue ?? (textInput.trim() || 10));
      if (!Number.isFinite(val) || val < 0) throw new Error('Enter a valid non-negative number.');
      const unitMultipliers: Record<string, number> = {
        B: 1,
        KB: 1024,
        MB: 1024 ** 2,
        GB: 1024 ** 3,
        TB: 1024 ** 4,
      };
      bytes = val * (unitMultipliers[options.sizeUnit || 'MB'] || 1);
    }
    const report = [
      `Bytes (B): ${bytes.toLocaleString()}`,
      `Kilobytes (KB / KiB): ${(bytes / 1024).toFixed(4)}`,
      `Megabytes (MB / MiB): ${(bytes / 1024 ** 2).toFixed(4)}`,
      `Gigabytes (GB / GiB): ${(bytes / 1024 ** 3).toFixed(6)}`,
      `Terabytes (TB / TiB): ${(bytes / 1024 ** 4).toFixed(8)}`,
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: 'file-size-conversion.txt', mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: 'file-size-conversion.txt',
      summaryLines: [`Converted ${formatBytes(bytes)}`],
    };
  }

  if (slug === 'md5-generator') {
    const file = files[0];
    let hex = '';
    let label = 'Text input';
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      hex = md5Bytes(bytes);
      label = `${file.name} (${formatBytes(file.size)})`;
    } else if (textInput.length > 0) {
      hex = md5Text(textInput);
    } else {
      throw new Error('Please upload a file or enter text to compute MD5.');
    }
    const blob = new Blob([hex + '\n'], { type: 'text/plain;charset=utf-8' });
    const filename = file ? `${file.name}.md5.txt` : 'md5.txt';
    return {
      files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
      textOutput: hex,
      outputFilename: filename,
      summaryLines: [`MD5 computed locally (RFC 1321)`, `Source: ${label}`],
    };
  }

  if (slug === 'sha-256-generator' || slug === 'sha-512-generator') {
    const alg = slug === 'sha-512-generator' ? 'SHA-512' : 'SHA-256';
    const file = files[0];
    let dataBuffer: ArrayBuffer;
    let label = 'Text input';
    if (file) {
      dataBuffer = await file.arrayBuffer();
      label = `${file.name} (${formatBytes(file.size)})`;
    } else if (textInput.length > 0) {
      dataBuffer = new TextEncoder().encode(textInput).buffer;
    } else {
      throw new Error('Please upload a file or enter text to hash.');
    }
    const digest = await crypto.subtle.digest(alg, dataBuffer);
    const hex = bufferToHex(digest);
    const report = `${alg} (${label}):\n${hex}`;
    const blob = new Blob([hex + '\n'], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: file ? `${file.name}.${alg.toLowerCase()}.txt` : `${alg.toLowerCase()}.txt`, mimeType: 'text/plain', size: blob.size }],
      textOutput: hex,
      outputFilename: file ? `${file.name}.${alg.toLowerCase()}.txt` : `${alg.toLowerCase()}.txt`,
      summaryLines: [`${alg} computed locally via Web Crypto API`, report.split('\n')[0]],
    };
  }

  if (files.length === 0) {
    throw new Error('Please select a file first.');
  }

  if (slug === 'zip-creator') {
    const totalOriginal = files.reduce((acc, f) => acc + f.size, 0);
    const zipBlob = await createZipBlob(files.map((f) => ({ filename: f.name, data: f })));
    const outName = files.length === 1 ? `${files[0].name}.zip` : 'nexctool-archive.zip';
    const savedPct = calculateSavingsPercent(totalOriginal, zipBlob.size);
    return {
      files: [{ blob: zipBlob, filename: outName, mimeType: 'application/zip', size: zipBlob.size }],
      outputFilename: outName,
      outputMimeType: 'application/zip',
      summaryLines: [
        `Archived ${files.length} file(s) into ${outName}`,
        `Total input: ${formatBytes(totalOriginal)} → Archive: ${formatBytes(zipBlob.size)}${savedPct > 0 ? ` (${savedPct}% smaller)` : ''}`,
      ],
      originalTotalBytes: totalOriginal,
      outputTotalBytes: zipBlob.size,
    };
  }

  if (slug === 'tar-creator') {
    const totalOriginal = files.reduce((acc, f) => acc + f.size, 0);
    const entries = await Promise.all(
      files.map(async (f) => ({
        filename: f.name,
        data: new Uint8Array(await f.arrayBuffer()),
      }))
    );
    const tarBytes = createTarArchive(entries);
    const tarBlob = toCopyBlob(tarBytes, 'application/x-tar');
    const outName = files.length === 1 ? `${files[0].name}.tar` : 'nexctool-archive.tar';
    return {
      files: [{ blob: tarBlob, filename: outName, mimeType: 'application/x-tar', size: tarBlob.size }],
      outputFilename: outName,
      outputMimeType: 'application/x-tar',
      summaryLines: [`Packed ${files.length} file(s) into POSIX TAR archive (${formatBytes(tarBlob.size)})`],
      originalTotalBytes: totalOriginal,
      outputTotalBytes: tarBlob.size,
    };
  }

  if (slug === 'tar-extractor') {
    const tarFile = files[0];
    let tarBytes = new Uint8Array(await tarFile.arrayBuffer());
    // Support .tar.gz / .tgz transparently if browser DecompressionStream exists
    if (/\.t?gz$/i.test(tarFile.name) && typeof DecompressionStream !== 'undefined') {
      const ds = new Blob([tarBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      tarBytes = new Uint8Array(await new Response(ds).arrayBuffer());
    }
    const entries = extractTarArchive(tarBytes);
    if (entries.length === 0) {
      throw new Error('No extractable files found inside this TAR archive.');
    }
    const outFiles: ProcessOutputFile[] = entries.map((e) => ({
      blob: toCopyBlob(e.data, 'application/octet-stream'),
      filename: e.filename.split('/').filter(Boolean).pop() || e.filename,
      mimeType: 'application/octet-stream',
      size: e.size,
    }));
    const listing = entries.map((e, i) => `${i + 1}. ${e.filename} (${formatBytes(e.size)})`).join('\n');
    return {
      files: outFiles,
      textOutput: listing,
      outputFilename: outFiles[0]?.filename,
      summaryLines: [`Extracted ${outFiles.length} file(s) from "${tarFile.name}"`],
      originalTotalBytes: tarFile.size,
      outputTotalBytes: outFiles.reduce((a, f) => a + f.size, 0),
    };
  }

  if (slug === 'zip-extractor') {
    const zipFile = files[0];
    const buffer = await zipFile.arrayBuffer();
    const entries = await extractZipEntries(buffer);
    if (entries.length === 0) {
      throw new Error('This ZIP archive contains no extractable files.');
    }
    const extractedTotal = entries.reduce((acc, e) => acc + e.size, 0);
    const listing = entries.map((e, i) => `${i + 1}. ${e.filename} (${formatBytes(e.size)})`).join('\n');
    return {
      files: entries.map((e) => ({
        blob: e.blob,
        filename: e.filename.split('/').filter(Boolean).pop() || e.filename,
        mimeType: e.mimeType,
        size: e.size,
      })),
      textOutput: listing,
      outputFilename: entries[0]?.filename,
      summaryLines: [`Extracted ${entries.length} file(s) from "${zipFile.name}" (${formatBytes(extractedTotal)})`],
      originalTotalBytes: zipFile.size,
      outputTotalBytes: extractedTotal,
    };
  }

  if (slug === 'archive-file-viewer') {
    const archFile = files[0];
    const lower = archFile.name.toLowerCase();
    let rows: { name: string; size: number }[] = [];

    if (lower.endsWith('.tar')) {
      rows = extractTarArchive(new Uint8Array(await archFile.arrayBuffer())).map((e) => ({
        name: e.filename,
        size: e.size,
      }));
    } else if (lower.endsWith('.gz') || lower.endsWith('.tgz')) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('DecompressionStream unavailable in this browser.');
      }
      const stream = archFile.stream().pipeThrough(new DecompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
        rows = extractTarArchive(new Uint8Array(buf)).map((e) => ({ name: e.filename, size: e.size }));
      } else {
        rows = [{ name: archFile.name.replace(/\.gz$/i, ''), size: buf.byteLength }];
      }
    } else {
      const entries = await extractZipEntries(await archFile.arrayBuffer());
      rows = entries.map((e) => ({ name: e.filename, size: e.size }));
    }

    const totalUnpacked = rows.reduce((a, r) => a + r.size, 0);
    const report = [
      `Archive: ${archFile.name} (${formatBytes(archFile.size)})`,
      `Entries: ${rows.length} file(s) · Unpacked size: ${formatBytes(totalUnpacked)}`,
      '',
      ...rows.map((r, i) => `${i + 1}. ${r.name} — ${formatBytes(r.size)}`),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: replaceExtension(archFile.name, 'contents.txt'), mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: replaceExtension(archFile.name, 'contents.txt'),
      summaryLines: [`Inspected ${rows.length} archive entries inside "${archFile.name}"`],
    };
  }

  if (slug === 'archive-converter') {
    const archFile = files[0];
    const target = options.archiveTarget ?? 'zip';
    const lower = archFile.name.toLowerCase();

    // Unpack source entries from ZIP, TAR, or GZIP
    let unpacked: { filename: string; data: Uint8Array }[] = [];
    if (lower.endsWith('.tar')) {
      unpacked = extractTarArchive(new Uint8Array(await archFile.arrayBuffer())).map((e) => ({
        filename: e.filename,
        data: e.data,
      }));
    } else if (lower.endsWith('.gz') || lower.endsWith('.tgz')) {
      const ds = archFile.stream().pipeThrough(new DecompressionStream('gzip'));
      const raw = new Uint8Array(await new Response(ds).arrayBuffer());
      if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
        unpacked = extractTarArchive(raw).map((e) => ({ filename: e.filename, data: e.data }));
      } else {
        unpacked = [{ filename: archFile.name.replace(/\.gz$/i, '') || 'file.bin', data: raw }];
      }
    } else {
      const entries = await extractZipEntries(await archFile.arrayBuffer());
      unpacked = await Promise.all(
        entries.map(async (e) => ({
          filename: e.filename,
          data: new Uint8Array(await e.blob.arrayBuffer()),
        }))
      );
    }

    if (target === 'tar') {
      const tarBytes = createTarArchive(unpacked);
      const blob = toCopyBlob(tarBytes, 'application/x-tar');
      const filename = replaceExtension(archFile.name, 'tar');
      return {
        files: [{ blob, filename, mimeType: 'application/x-tar', size: blob.size }],
        outputFilename: filename,
        summaryLines: [`Converted ${unpacked.length} file(s) from "${archFile.name}" to TAR`],
        originalTotalBytes: archFile.size,
        outputTotalBytes: blob.size,
      };
    }

    if (target === 'gz') {
      const tarBytes = createTarArchive(unpacked);
      const cs = toCopyBlob(tarBytes, 'application/x-tar').stream().pipeThrough(new CompressionStream('gzip'));
      const gzBlob = await new Response(cs).blob();
      const filename = replaceExtension(archFile.name, 'tar.gz');
      return {
        files: [{ blob: gzBlob, filename, mimeType: 'application/gzip', size: gzBlob.size }],
        outputFilename: filename,
        summaryLines: [`Converted ${unpacked.length} file(s) from "${archFile.name}" to TAR.GZ`],
        originalTotalBytes: archFile.size,
        outputTotalBytes: gzBlob.size,
      };
    }

    const zipBlob = await createZipBlob(
      unpacked.map((u) => ({ filename: u.filename, data: u.data }))
    );
    const filename = replaceExtension(archFile.name, 'zip');
    return {
      files: [{ blob: zipBlob, filename, mimeType: 'application/zip', size: zipBlob.size }],
      outputFilename: filename,
      summaryLines: [`Converted ${unpacked.length} file(s) from "${archFile.name}" to ZIP`],
      originalTotalBytes: archFile.size,
      outputTotalBytes: zipBlob.size,
    };
  }

  if (slug === 'duplicate-file-checker') {
    if (files.length < 2) {
      throw new Error('Please select at least 2 files to compare for duplicates.');
    }
    const hashes = new Map<string, string[]>();
    for (const f of files) {
      const digest = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
      const hex = bufferToHex(digest);
      const list = hashes.get(hex) ?? [];
      list.push(`${f.name} (${formatBytes(f.size)})`);
      hashes.set(hex, list);
    }
    const dupGroups = Array.from(hashes.entries()).filter(([, list]) => list.length > 1);
    const lines = [
      `Scanned ${files.length} files (${hashes.size} unique file contents):`,
      '',
      ...(dupGroups.length === 0
        ? ['No duplicate files detected. Every selected file has a unique SHA-256 checksum.']
        : dupGroups.map(([hex, list], idx) => `Duplicate Group ${idx + 1} [${hex.slice(0, 12)}...]:\n  - ${list.join('\n  - ')}`)),
    ];
    const report = lines.join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: 'duplicate-report.txt', mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: 'duplicate-report.txt',
      summaryLines: [
        dupGroups.length === 0
          ? `All ${files.length} files are unique`
          : `Found ${dupGroups.length} duplicate group(s) among ${files.length} files`,
      ],
    };
  }

  if (slug === 'file-merger') {
    if (files.length < 2) throw new Error('Select at least 2 files to concatenate.');
    const blob = new Blob(files, { type: 'application/octet-stream' });
    return {
      files: [{ blob, filename: 'merged-file.bin', mimeType: 'application/octet-stream', size: blob.size }],
      outputFilename: 'merged-file.bin',
      summaryLines: [`Merged ${files.length} files (${formatBytes(blob.size)})`],
      originalTotalBytes: files.reduce((acc, f) => acc + f.size, 0),
      outputTotalBytes: blob.size,
    };
  }

  const file = files[0];

  if (slug === 'file-splitter') {
    const chunkBytes = Math.max(1024, (options.splitSizeKb ?? 512) * 1024);
    const parts: { blob: Blob; filename: string; mimeType: string; size: number }[] = [];
    let offset = 0;
    let index = 1;
    while (offset < file.size) {
      const slice = file.slice(offset, offset + chunkBytes);
      parts.push({
        blob: slice,
        filename: `${file.name}.part${String(index).padStart(3, '0')}`,
        mimeType: 'application/octet-stream',
        size: slice.size,
      });
      offset += chunkBytes;
      index++;
    }
    return {
      files: parts,
      outputFilename: parts[0]?.filename,
      summaryLines: [`Split "${file.name}" into ${parts.length} part(s) of up to ${formatBytes(chunkBytes)}`],
      originalTotalBytes: file.size,
      outputTotalBytes: file.size,
    };
  }

  if (slug === 'file-type-detector' || slug === 'file-extension-checker' || slug === 'file-metadata-viewer') {
    const headerBuf = await file.slice(0, 16).arrayBuffer();
    const detected = detectMagicType(new Uint8Array(headerBuf), file.name);
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'none';
    const report = [
      `File Name: ${file.name}`,
      `Extension: .${ext}`,
      `Detected Signature: ${detected}`,
      `Reported MIME Type: ${file.type || 'none'}`,
      `File Size: ${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`,
      `Last Modified: ${new Date(file.lastModified).toISOString()}`,
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    return {
      files: [{ blob, filename: replaceExtension(file.name, 'info.txt'), mimeType: 'text/plain', size: blob.size }],
      textOutput: report,
      outputFilename: replaceExtension(file.name, 'info.txt'),
      summaryLines: [`Detected: ${detected}`],
    };
  }

  if (slug === 'gzip-compressor') {
    if (typeof CompressionStream === 'undefined') {
      throw new Error('CompressionStream API is not available in this browser.');
    }
    const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
    const blob = await new Response(stream).blob();
    const filename = `${file.name}.gz`;
    return {
      files: [{ blob, filename, mimeType: 'application/gzip', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'application/gzip',
      summaryLines: [`Compressed ${formatBytes(file.size)} → ${formatBytes(blob.size)}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  if (slug === 'gzip-extractor') {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream API is not available in this browser.');
    }
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    const blob = await new Response(stream).blob();
    const filename = file.name.endsWith('.gz') ? file.name.slice(0, -3) || 'extracted-file' : `${file.name}.extracted`;
    return {
      files: [{ blob, filename, mimeType: 'application/octet-stream', size: blob.size }],
      outputFilename: filename,
      summaryLines: [`Decompressed ${formatBytes(file.size)} → ${formatBytes(blob.size)}`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  }

  throw new Error(`Utility "${slug}" is not configured.`);
}
