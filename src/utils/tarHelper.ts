export interface TarEntryInput {
  filename: string;
  data: Uint8Array;
}

export interface ExtractedTarEntry {
  filename: string;
  data: Uint8Array;
  size: number;
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number): void {
  const octal = value.toString(8).padStart(length - 1, '0');
  for (let i = 0; i < octal.length && i < length - 1; i++) {
    target[offset + i] = octal.charCodeAt(i);
  }
  target[offset + length - 1] = 0;
}

function writeAscii(target: Uint8Array, offset: number, length: number, text: string): void {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  for (let i = 0; i < bytes.length && i < length; i++) {
    target[offset + i] = bytes[i];
  }
}

function readAscii(source: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const max = Math.min(source.length, offset + length);
  while (end < max && source[end] !== 0) {
    end++;
  }
  return new TextDecoder().decode(source.subarray(offset, end));
}

export function createTarArchive(entries: TarEntryInput[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (const entry of entries) {
    const cleanName = entry.filename.replace(/^\/+/, '').slice(0, 99) || 'file.bin';
    const header = new Uint8Array(512);
    writeAscii(header, 0, 100, cleanName);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.data.length);
    writeOctal(header, 136, 12, nowSec);

    // Checksum field filled with spaces during sum
    for (let i = 148; i < 156; i++) header[i] = 32;
    header[156] = '0'.charCodeAt(0); // regular file
    writeAscii(header, 257, 6, 'ustar');
    header[263] = '0'.charCodeAt(0);
    header[264] = '0'.charCodeAt(0);

    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    const chkStr = checksum.toString(8).padStart(6, '0');
    for (let i = 0; i < 6; i++) header[148 + i] = chkStr.charCodeAt(i);
    header[154] = 0;
    header[155] = 32;

    blocks.push(header);

    const paddedLen = Math.ceil(entry.data.length / 512) * 512;
    if (paddedLen > 0) {
      const dataBlock = new Uint8Array(paddedLen);
      dataBlock.set(entry.data, 0);
      blocks.push(dataBlock);
    }
  }

  // Two zero blocks mark end of archive
  blocks.push(new Uint8Array(1024));

  const totalSize = blocks.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(totalSize);
  let cursor = 0;
  for (const block of blocks) {
    out.set(block, cursor);
    cursor += block.length;
  }
  return out;
}

export function extractTarArchive(tarBytes: Uint8Array): ExtractedTarEntry[] {
  const entries: ExtractedTarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + 512);
    const isEmpty = header.every((b) => b === 0);
    if (isEmpty) break;

    const name = readAscii(header, 0, 100);
    const prefix = readAscii(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeRaw = readAscii(header, 124, 12).trim();
    const size = parseInt(sizeRaw, 8) || 0;
    const typeFlag = String.fromCharCode(header[156] || 48);

    offset += 512;
    const paddedSize = Math.ceil(size / 512) * 512;

    if ((typeFlag === '0' || typeFlag === '\0') && fullName) {
      const slice = tarBytes.slice(offset, Math.min(tarBytes.length, offset + size));
      entries.push({
        filename: fullName,
        data: slice,
        size: slice.length,
      });
    }

    offset += paddedSize;
  }

  return entries;
}
