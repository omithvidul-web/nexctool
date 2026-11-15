import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import coreUrlAsset from '@ffmpeg/core?url';
import wasmUrlAsset from '@ffmpeg/core/wasm?url';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let jobMutex: Promise<unknown> = Promise.resolve();

async function getLoadedFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(coreUrlAsset, 'text/javascript'),
        toBlobURL(wasmUrlAsset, 'application/wasm'),
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
