import { Archive } from 'libarchive.js';
import sevenZipWasmUrl from '7z-wasm/7zz.wasm?url';

let libarchiveInitialized = false;

function ensureLibarchiveInit(): void {
  if (!libarchiveInitialized) {
    Archive.init({
      workerUrl: '/wasm/libarchive/worker-bundle.js',
    });
    libarchiveInitialized = true;
  }
}

export interface ExtractedArchiveEntry {
  filename: string;
  path: string;
  file: File;
  size: number;
}

function flattenArchiveTree(
  tree: Record<string, unknown>,
  prefix = ''
): ExtractedArchiveEntry[] {
  const out: ExtractedArchiveEntry[] = [];
  for (const [key, value] of Object.entries(tree)) {
    if (!value) continue;
    const fullPath = prefix ? `${prefix}/${key}` : key;
    if (value instanceof File) {
      out.push({
        filename: value.name || key,
        path: fullPath,
        file: value,
        size: value.size,
      });
    } else if (typeof value === 'object') {
      out.push(...flattenArchiveTree(value as Record<string, unknown>, fullPath));
    }
  }
  return out;
}

async function extract7zWith7zWasm(
  archiveFile: File,
  password?: string
): Promise<ExtractedArchiveEntry[]> {
  const cleanPass = password?.trim() || '';
  const sevenZipMod = await import('7z-wasm');
  const SevenZip = sevenZipMod.default;
  const sz = await SevenZip({
    locateFile: (path) => (path.endsWith('.wasm') ? sevenZipWasmUrl : path),
  });

  const workDir = `/work_${Date.now()}`;
  const outDir = `${workDir}/out`;
  sz.FS.mkdir(workDir);
  sz.FS.mkdir(outDir);

  const safeArchiveName = archiveFile.name.replace(/[\\/]/g, '_') || 'archive.7z';
  const archivePath = `${workDir}/${safeArchiveName}`;
  sz.FS.writeFile(archivePath, new Uint8Array(await archiveFile.arrayBuffer()));

  let extractFailed = false;
  try {
    sz.callMain([
      'x',
      '-y',
      cleanPass ? `-p${cleanPass}` : '-p',
      `-o${outDir}`,
      archivePath,
    ]);
  } catch {
    extractFailed = true;
  }

  const collected: ExtractedArchiveEntry[] = [];
  const walk = (dir: string, relPrefix: string) => {
    const names = sz.FS.readdir(dir);
    for (const name of names) {
      if (name === '.' || name === '..') continue;
      const full = `${dir}/${name}`;
      const stat = sz.FS.stat(full);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      if (sz.FS.isDir(stat.mode)) {
        walk(full, rel);
      } else {
        const raw = sz.FS.readFile(full);
        const copy = new Uint8Array(raw.byteLength);
        copy.set(raw);
        const fileObj = new File([copy.buffer], name, { type: 'application/octet-stream' });
        collected.push({
          filename: name,
          path: rel,
          file: fileObj,
          size: fileObj.size,
        });
      }
    }
  };
  walk(outDir, '');

  if (collected.length === 0) {
    if (!cleanPass && extractFailed) {
      throw new Error(
        'This archive is password-protected. Please enter the password in Options above.'
      );
    }
    throw new Error(
      cleanPass
        ? `Incorrect password or no extractable files found inside "${archiveFile.name}".`
        : !cleanPass
          ? 'This archive may be password-protected or contains no extractable files. If locked, enter the password in Options above.'
          : `No extractable files found inside "${archiveFile.name}".`
    );
  }
  return collected;
}

export async function extractArchiveWithLibarchive(
  archiveFile: File,
  password?: string
): Promise<ExtractedArchiveEntry[]> {
  ensureLibarchiveInit();
  const is7z = archiveFile.name.toLowerCase().endsWith('.7z');
  const cleanPass = password?.trim() || '';

  let libarchiveErr: unknown = null;
  try {
    const archive = await Archive.open(archiveFile);
    try {
      if (cleanPass) {
        await archive.usePassword(cleanPass);
      }
      const encrypted = await archive.hasEncryptedData();
      if (encrypted && !cleanPass) {
        throw new Error(
          'This archive is password-protected. Please enter the password in Options above.'
        );
      }
      const extractedTree = await archive.extractFiles();
      const entries = flattenArchiveTree(extractedTree as unknown as Record<string, unknown>);
      if (entries.length > 0) {
        return entries;
      }
    } finally {
      await archive.close().catch(() => {});
    }
  } catch (err) {
    libarchiveErr = err;
    // Re-throw explicit password prompt for non-7z unless 7z fallback should inspect header-encrypted 7z
    if (!is7z) {
      throw err;
    }
  }

  if (is7z) {
    return extract7zWith7zWasm(archiveFile, cleanPass);
  }

  if (libarchiveErr instanceof Error) {
    throw libarchiveErr;
  }
  throw new Error(`No extractable files found inside "${archiveFile.name}".`);
}

export async function create7zArchiveWithLibarchive(
  files: File[],
  outputFilename = 'nexctool-archive.7z',
  password?: string | null
): Promise<File> {
  const cleanPass = password?.trim() ? password.trim() : null;
  const sevenZipMod = await import('7z-wasm');
  const SevenZip = sevenZipMod.default;
  const sz = await SevenZip({
    locateFile: (path) => (path.endsWith('.wasm') ? sevenZipWasmUrl : path),
  });

  const workDir = '/work';
  try {
    sz.FS.mkdir(workDir);
  } catch {
    // ignore if directory already exists
  }

  const inputPaths: string[] = [];
  for (const f of files) {
    const safeName = f.name.replace(/[\\/]/g, '_') || 'file.bin';
    const dest = `${workDir}/${safeName}`;
    sz.FS.writeFile(dest, new Uint8Array(await f.arrayBuffer()));
    inputPaths.push(dest);
  }

  const outPath = `${workDir}/${outputFilename}`;
  const args = cleanPass
    ? ['a', '-t7z', '-mx=5', `-p${cleanPass}`, '-mhe=on', outPath, ...inputPaths]
    : ['a', '-t7z', '-mx=5', outPath, ...inputPaths];
  sz.callMain(args);

  const outBytes = sz.FS.readFile(outPath);
  const copy = new Uint8Array(outBytes.byteLength);
  copy.set(outBytes);
  return new File([copy.buffer], outputFilename, {
    type: 'application/x-7z-compressed',
  });
}
