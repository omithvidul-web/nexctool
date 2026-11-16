import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import coreUrlAsset from '@ffmpeg/core?url';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let jobMutex: Promise<unknown> = Promise.resolve();

async function loadChunkedFfmpegWasmUrl(): Promise<string> {
  const [res1, res2] = await Promise.all([
    fetch('/wasm/ffmpeg/ffmpeg-core-part1.bin'),
    fetch('/wasm/ffmpeg/ffmpeg-core-part2.bin'),
  ]);
  if (!res1.ok || !res2.ok) {
    throw new Error('Failed to download FFmpeg WebAssembly runtime chunks.');
  }
  const [buf1, buf2] = await Promise.all([res1.arrayBuffer(), res2.arrayBuffer()]);
  const magic = new Uint8Array(buf1, 0, Math.min(4, buf1.byteLength));
  if (
    magic.length < 4 ||
    magic[0] !== 0x00 ||
    magic[1] !== 0x61 ||
    magic[2] !== 0x73 ||
    magic[3] !== 0x6d
  ) {
    throw new Error('Invalid FFmpeg WebAssembly header received.');
  }
  const wasmBlob = new Blob([buf1, buf2], { type: 'application/wasm' });
  return URL.createObjectURL(wasmBlob);
}

async function getLoadedFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(coreUrlAsset, 'text/javascript'),
        loadChunkedFfmpegWasmUrl(),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
    loadPromise.catch(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

export async function runFfmpegJob(
  inputFile: File,
  inputExt: string,
  outputExt: string,
  argsBuilder: (inName: string, outName: string) => string[],
  fallbackArgsBuilder?: (inName: string, outName: string) => string[]
): Promise<Uint8Array> {
  const execTask = async (): Promise<Uint8Array> => {
    const ffmpeg = await getLoadedFfmpeg();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanInExt = inputExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const cleanOutExt = outputExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const inName = `in_${id}.${cleanInExt}`;
    const outName = `out_${id}.${cleanOutExt}`;

    const bytes = new Uint8Array(await inputFile.arrayBuffer());
    await ffmpeg.writeFile(inName, bytes);

    try {
      const args = argsBuilder(inName, outName);
      let code = await ffmpeg.exec(args);
      if (code !== 0 && fallbackArgsBuilder) {
        try {
          await ffmpeg.deleteFile(outName);
        } catch {
          // ignore
        }
        code = await ffmpeg.exec(fallbackArgsBuilder(inName, outName));
      }
      if (code !== 0) {
        throw new Error(`FFmpeg conversion exited with status code ${code}.`);
      }
      const data = await ffmpeg.readFile(outName);
      if (!(data instanceof Uint8Array) || data.byteLength === 0) {
        throw new Error('FFmpeg produced an empty output file.');
      }
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      return copy;
    } finally {
      await ffmpeg.deleteFile(inName).catch(() => {});
      await ffmpeg.deleteFile(outName).catch(() => {});
    }
  };

  const queued = jobMutex.then(execTask, execTask);
  jobMutex = queued.catch(() => {});
  return queued;
}
