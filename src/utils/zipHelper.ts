import JSZip from 'jszip';

export interface ZipInputEntry {
  filename: string;
  data: Blob | ArrayBuffer | Uint8Array;
}

export interface ExtractedZipEntry {
  filename: string;
  blob: Blob;
  size: number;
  mimeType: string;
}

function guessMimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  return 'application/octet-stream';
}

export async function createZipBlob(entries: ZipInputEntry[]): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const entry of entries) {
    let safeName = entry.filename.replace(/^\/+/, '') || 'file.bin';
    const count = usedNames.get(safeName) ?? 0;
    if (count > 0) {
      const dotIdx = safeName.lastIndexOf('.');
      safeName =
        dotIdx > 0
          ? `${safeName.slice(0, dotIdx)}-${count + 1}${safeName.slice(dotIdx)}`
          : `${safeName}-${count + 1}`;
    }
    usedNames.set(entry.filename, count + 1);
    zip.file(safeName, entry.data);
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function extractZipEntries(buffer: ArrayBuffer): Promise<ExtractedZipEntry[]> {
  const zip = await JSZip.loadAsync(buffer);
  const extracted: ExtractedZipEntry[] = [];

  const fileEntries = Object.values(zip.files).filter((f) => !f.dir);
  for (const zipObj of fileEntries) {
    const uint8 = await zipObj.async('uint8array');
    const cleanCopy = new Uint8Array(uint8.byteLength);
    cleanCopy.set(uint8);
    const shortName = zipObj.name.split('/').filter(Boolean).pop() || zipObj.name;
    const mimeType = guessMimeFromFilename(shortName);
    const blob = new Blob([cleanCopy.buffer], { type: mimeType });
    extracted.push({
      filename: zipObj.name,
      blob,
      size: blob.size,
      mimeType,
    });
  }

  return extracted;
}
