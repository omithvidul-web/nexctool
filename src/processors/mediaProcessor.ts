import type { ProcessOptions, ProcessResult } from './types';
import { calculateSavingsPercent, formatBytes, replaceExtension } from '../utils/formatters';
import { encodeAnimatedGif } from '../utils/gifEncoder';
import { applyId3v2Metadata, encodeWavBufferWithMeta } from '../utils/id3Helper';
import { computeVideoCompressionPlan, getVideoMimeCandidates } from '../utils/videoCompression';

function toBinaryBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType });
}

function createAudioContext(): AudioContext {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AudioCtx();
}

function encodeWavFromAudioBuffer(buffer: AudioBuffer): Uint8Array {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  return encodeWavBufferWithMeta(channels, buffer.sampleRate);
}

async function encodeMp3FromAudioBuffer(buffer: AudioBuffer, kbps = 128): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps);

  const floatToInt16 = (f32: Float32Array): Int16Array => {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return out;
  };

  const left = floatToInt16(buffer.getChannelData(0));
  const right = channels > 1 ? floatToInt16(buffer.getChannelData(1)) : undefined;

  const mp3Parts: Uint8Array[] = [];
  const blockSize = 1152;
  for (let i = 0; i < left.length; i += blockSize) {
    const lChunk = left.subarray(i, i + blockSize);
    const rChunk = right ? right.subarray(i, i + blockSize) : undefined;
    const encoded = encoder.encodeBuffer(lChunk, rChunk);
    if (encoded.length > 0) mp3Parts.push(new Uint8Array(encoded));
  }
  const end = encoder.flush();
  if (end.length > 0) mp3Parts.push(new Uint8Array(end));

  const totalLen = mp3Parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of mp3Parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetRate: number,
  targetChannels: number
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetRate && buffer.numberOfChannels === targetChannels) {
    return buffer;
  }
  const frameCount = Math.max(1, Math.ceil(buffer.duration * targetRate));
  const offline = new OfflineAudioContext(targetChannels, frameCount, targetRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start(0);
  return offline.startRendering();
}

function removeSilentWindows(buffer: AudioBuffer, threshold = 0.012): AudioBuffer {
  const sr = buffer.sampleRate;
  const winSamples = Math.max(256, Math.round(sr * 0.02)); // 20ms windows
  const chCount = buffer.numberOfChannels;
  const channels: Float32Array[] = [];
  for (let c = 0; c < chCount; c++) {
    channels.push(buffer.getChannelData(c));
  }

  const totalWindows = Math.ceil(buffer.length / winSamples);
  const activeMask = new Uint8Array(totalWindows);

  for (let w = 0; w < totalWindows; w++) {
    const start = w * winSamples;
    const end = Math.min(buffer.length, start + winSamples);
    let sumSq = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      for (let c = 0; c < chCount; c++) {
        const v = channels[c][i];
        sumSq += v * v;
        count++;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    if (rms >= threshold) {
      // Keep 2 windows before and after speech/sound for natural transitions
      for (let pad = Math.max(0, w - 2); pad <= Math.min(totalWindows - 1, w + 2); pad++) {
        activeMask[pad] = 1;
      }
    }
  }

  let keptSamples = 0;
  for (let w = 0; w < totalWindows; w++) {
    if (activeMask[w]) {
      const start = w * winSamples;
      keptSamples += Math.min(buffer.length, start + winSamples) - start;
    }
  }

  if (keptSamples === 0) {
    return buffer;
  }

  const offline = new OfflineAudioContext(chCount, keptSamples, sr);
  const outBuf = offline.createBuffer(chCount, keptSamples, sr);
  for (let c = 0; c < chCount; c++) {
    const dest = outBuf.getChannelData(c);
    const src = channels[c];
    let writeOffset = 0;
    for (let w = 0; w < totalWindows; w++) {
      if (!activeMask[w]) continue;
      const start = w * winSamples;
      const end = Math.min(buffer.length, start + winSamples);
      dest.set(src.subarray(start, end), writeOffset);
      writeOffset += end - start;
    }
  }
  return outBuf;
}

function pickSupportedVideoMime(
  preferMp4: boolean,
  hasAudio = true
): { mime: string; ext: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder API is unavailable in this browser.');
  }
  const candidates = getVideoMimeCandidates(preferMp4, hasAudio);
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return preferMp4
    ? { mime: 'video/mp4', ext: 'mp4' }
    : { mime: 'video/webm', ext: 'webm' };
}

function createSafeMediaRecorder(
  stream: MediaStream,
  fallbackVideoOnlyStream: MediaStream,
  preferMp4: boolean,
  hasAudio: boolean,
  videoBitsPerSecond: number
): { recorder: MediaRecorder; mime: string; ext: 'mp4' | 'webm' } {
  const chosen = pickSupportedVideoMime(preferMp4, hasAudio);
  const attempts: Array<{ s: MediaStream; opts: MediaRecorderOptions; info: { mime: string; ext: 'mp4' | 'webm' } }> = [
    { s: stream, opts: { mimeType: chosen.mime, videoBitsPerSecond }, info: chosen },
    { s: stream, opts: { mimeType: chosen.mime }, info: chosen },
    { s: stream, opts: { videoBitsPerSecond }, info: chosen },
  ];

  const videoOnlyMime = pickSupportedVideoMime(preferMp4, false);
  attempts.push(
    { s: fallbackVideoOnlyStream, opts: { mimeType: videoOnlyMime.mime, videoBitsPerSecond }, info: videoOnlyMime },
    { s: fallbackVideoOnlyStream, opts: { mimeType: videoOnlyMime.mime }, info: videoOnlyMime },
    { s: fallbackVideoOnlyStream, opts: {}, info: videoOnlyMime }
  );

  let lastErr: unknown = null;
  for (const attempt of attempts) {
    try {
      const recorder = new MediaRecorder(attempt.s, attempt.opts);
      const effectiveMime = recorder.mimeType || attempt.info.mime;
      const ext: 'mp4' | 'webm' = effectiveMime.includes('mp4') ? 'mp4' : attempt.info.ext;
      return { recorder, mime: effectiveMime, ext };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Unable to initialize browser video recorder for this format.');
}

function loadVideoMetadata(
  file: File
): Promise<{ video: HTMLVideoElement; url: string; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0.001;pointer-events:none;';
    document.body.appendChild(video);

    let settled = false;
    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.remove();
      URL.revokeObjectURL(url);
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Timed out loading video "${file.name}". This codec may not be supported by your browser.`));
    }, 15_000);

    const onReady = () => {
      if (settled) return;
      if (video.videoWidth > 0 || video.readyState >= 2) {
        settled = true;
        window.clearTimeout(timeoutId);
        resolve({ video, url, cleanup });
      }
    };

    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener(
      'error',
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        cleanup();
        reject(new Error(`Unable to decode video "${file.name}" in this browser.`));
      },
      { once: true }
    );

    video.src = url;
    video.load();
  });
}

async function transcodeVideosViaCanvas(
  files: File[],
  config: {
    preferMp4: boolean;
    targetWidth?: number;
    targetHeight?: number;
    rotationDeg?: 0 | 90 | 180 | 270;
    trimStartSec?: number;
    trimEndSec?: number;
    speedFactor?: number;
    videoBitsPerSecond?: number;
    compressQuality?: number;
    stripAudio?: boolean;
  }
): Promise<{ blob: Blob; ext: 'mp4' | 'webm'; width: number; height: number; mime: string }> {
  const firstMeta = await loadVideoMetadata(files[0]);
  const cleanupQueue: Array<() => void> = [firstMeta.cleanup];

  try {
    const natW = firstMeta.video.videoWidth || 640;
    const natH = firstMeta.video.videoHeight || 360;
    const firstDur =
      Number.isFinite(firstMeta.video.duration) && firstMeta.video.duration > 0
        ? firstMeta.video.duration
        : 0;

    let drawW: number;
    let drawH: number;
    let effectiveBps = config.videoBitsPerSecond ?? 1_500_000;

    if (config.compressQuality !== undefined) {
      const plan = computeVideoCompressionPlan({
        naturalWidth: natW,
        naturalHeight: natH,
        fileSizeBytes: files[0].size,
        durationSec: firstDur,
        quality: config.compressQuality,
      });
      drawW = plan.targetWidth;
      drawH = plan.targetHeight;
      effectiveBps = plan.videoBitsPerSecond;
    } else {
      drawW = config.targetWidth && config.targetWidth > 0 ? config.targetWidth : natW;
      drawH =
        config.targetHeight && config.targetHeight > 0
          ? config.targetHeight
          : Math.max(2, Math.round((natH / natW) * drawW));
      if (!config.targetWidth && !config.targetHeight) {
        drawW = natW;
        drawH = natH;
      }
      drawW = Math.max(2, Math.round(drawW / 2) * 2);
      drawH = Math.max(2, Math.round(drawH / 2) * 2);
    }

    const rot = config.rotationDeg ?? 0;
    const swap = rot === 90 || rot === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? drawH : drawW;
    canvas.height = swap ? drawW : drawH;
    // alpha:false prevents clearRect alpha flushing bugs that produce 0-byte MediaRecorder outputs in Chromium
    const ctx = canvas.getContext('2d', { alpha: false }) ?? canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }

    const paintVideoFrame = (videoEl: HTMLVideoElement) => {
      if (rot !== 0) {
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(videoEl, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(videoEl, 0, 0, drawW, drawH);
      }
    };

    // Draw first frame before starting captureStream so MediaRecorder immediately has pixel data
    paintVideoFrame(firstMeta.video);

    const canvasStream = canvas.captureStream(30);
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    let hasAudio = false;

    if (!config.stripAudio && files.length === 1) {
      const capVideo = firstMeta.video as HTMLVideoElement & { captureStream?: () => MediaStream };
      if (typeof capVideo.captureStream === 'function') {
        try {
          const audioTracks = capVideo.captureStream().getAudioTracks();
          if (audioTracks.length > 0) {
            tracks.push(audioTracks[0]);
            hasAudio = true;
          }
        } catch {
          // Fallback to video-only stream when captureStream audio isn't exposed
        }
      }
    }

    const combinedStream = new MediaStream(tracks);
    const { recorder, mime: recorderMime, ext } = createSafeMediaRecorder(
      combinedStream,
      canvasStream,
      config.preferMp4,
      hasAudio,
      effectiveBps
    );

    const chunks: Blob[] = [];
    let recorderError: string | null = null;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onerror = (ev) => {
      const errObj = (ev as unknown as { error?: Error }).error;
      recorderError = errObj?.message || 'Browser video encoder encountered an error.';
    };

    const cleanMime = recorderMime.split(';')[0] || (ext === 'mp4' ? 'video/mp4' : 'video/webm');
    const stoppedPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: cleanMime }));
    });

    recorder.start(200);

    const playSingleSegment = async (video: HTMLVideoElement, startSec: number, endSec: number) => {
      const rate = Math.min(4, Math.max(0.25, config.speedFactor ?? 1));
      video.playbackRate = rate;
      video.muted = true; // Must stay muted to satisfy autoplay policy inside headless/mobile browsers
      if (startSec > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(startSec, Math.max(0, video.duration - 0.1));
        await new Promise<void>((res) => {
          video.onseeked = () => res();
          setTimeout(res, 250);
        });
      }

      let running = true;
      let rafId = 0;
      const drawFrame = () => {
        if (!running) return;
        paintVideoFrame(video);
        rafId = requestAnimationFrame(drawFrame);
      };
      // Fallback 30fps timer guarantees frames continue pumping if rAF is throttled
      const backupTimer = window.setInterval(() => {
        if (running) paintVideoFrame(video);
      }, 33);

      drawFrame();
      await video.play();

      const segDur = Math.max(1, endSec > startSec && Number.isFinite(endSec) ? endSec - startSec : 15);
      const maxWaitMs = Math.max(30_000, Math.min(300_000, Math.ceil((segDur / rate) * 1000) + 15_000));

      await new Promise<void>((resolve) => {
        const limit = endSec > startSec && Number.isFinite(endSec) ? endSec : Number.POSITIVE_INFINITY;
        const checkDone = () => {
          if (video.ended || video.currentTime >= limit) {
            cleanupSegment();
            resolve();
          }
        };
        const onEnded = () => {
          cleanupSegment();
          resolve();
        };
        const safetyTimer = window.setTimeout(() => {
          cleanupSegment();
          resolve();
        }, maxWaitMs);
        const cleanupSegment = () => {
          running = false;
          cancelAnimationFrame(rafId);
          window.clearInterval(backupTimer);
          video.pause();
          video.removeEventListener('timeupdate', checkDone);
          video.removeEventListener('ended', onEnded);
          window.clearTimeout(safetyTimer);
        };
        video.addEventListener('timeupdate', checkDone);
        video.addEventListener('ended', onEnded);
      });
    };

    try {
      const dur = Number.isFinite(firstMeta.video.duration) ? firstMeta.video.duration : 10;
      const start = Math.max(0, config.trimStartSec ?? 0);
      const end = config.trimEndSec && config.trimEndSec > start ? Math.min(dur, config.trimEndSec) : dur;
      await playSingleSegment(firstMeta.video, start, end);

      for (let i = 1; i < files.length; i++) {
        const nextMeta = await loadVideoMetadata(files[i]);
        cleanupQueue.push(nextMeta.cleanup);
        const nextDur = Number.isFinite(nextMeta.video.duration) ? nextMeta.video.duration : 10;
        await playSingleSegment(nextMeta.video, 0, nextDur);
      }
    } finally {
      if (recorder.state === 'recording') {
        try {
          recorder.requestData();
        } catch {
          // Ignore requestData errors when recorder is already stopping
        }
        recorder.stop();
      } else if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }

    const outBlob = await stoppedPromise;
    if (recorderError && outBlob.size === 0) {
      throw new Error(recorderError);
    }
    if (outBlob.size === 0) {
      throw new Error(
        'Browser produced an empty video output. Try lowering Output Quality or converting the video to standard MP4/WebM first.'
      );
    }
    return {
      blob: outBlob,
      ext,
      width: canvas.width,
      height: canvas.height,
      mime: cleanMime,
    };
  } finally {
    for (const fn of cleanupQueue) {
      try {
        fn();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export async function processMediaTool(
  slug: string,
  files: File[],
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error('Please select a media file first.');

  // 1. Audio Decoding & Pure-JS Encoding / Processing Tools
  if (
    slug === 'mp3-to-wav' ||
    slug === 'wav-to-mp3' ||
    slug === 'm4a-to-mp3' ||
    slug === 'flac-to-mp3' ||
    slug === 'ogg-to-mp3' ||
    slug === 'aac-to-mp3' ||
    slug === 'video-to-mp3' ||
    slug === 'video-to-wav' ||
    slug === 'audio-trimmer' ||
    slug === 'audio-merger' ||
    slug === 'audio-volume-changer' ||
    slug === 'audio-speed-changer' ||
    slug === 'audio-silence-remover' ||
    slug === 'audio-compressor' ||
    slug === 'audio-metadata-editor'
  ) {
    // Fast-path pure byte ID3v2 rewrite when input is already MP3
    if (
      slug === 'audio-metadata-editor' &&
      (file.name.toLowerCase().endsWith('.mp3') || file.type === 'audio/mpeg')
    ) {
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const tagged = applyId3v2Metadata(rawBytes, {
        title: options.audioTitle || file.name.replace(/\.mp3$/i, ''),
        artist: options.audioArtist || 'Unknown Artist',
        album: options.audioAlbum || 'NexcTool Audio',
      });
      const blob = toBinaryBlob(tagged, 'audio/mpeg');
      const filename = replaceExtension(file.name, 'tagged.mp3');
      return {
        files: [{ blob, filename, mimeType: 'audio/mpeg', size: blob.size }],
        outputFilename: filename,
        outputMimeType: 'audio/mpeg',
        summaryLines: [
          `Embedded ID3v2.4 metadata tags into ${filename}`,
          `Title: ${options.audioTitle || file.name} · Artist: ${options.audioArtist || 'Unknown Artist'}`,
        ],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }

    const ctx = createAudioContext();
    try {
      if (slug === 'audio-merger') {
        if (files.length < 2) {
          throw new Error('Please select at least 2 audio files to merge.');
        }
        const decodedList: AudioBuffer[] = [];
        let totalOriginal = 0;
        for (const f of files) {
          totalOriginal += f.size;
          decodedList.push(await ctx.decodeAudioData(await f.arrayBuffer()));
        }
        const targetRate = decodedList[0].sampleRate;
        const targetChannels = Math.min(2, Math.max(...decodedList.map((b) => b.numberOfChannels)));
        const normalized: AudioBuffer[] = [];
        let totalFrames = 0;
        for (const b of decodedList) {
          const resampled = await resampleAudioBuffer(b, targetRate, targetChannels);
          normalized.push(resampled);
          totalFrames += resampled.length;
        }
        const offline = new OfflineAudioContext(targetChannels, Math.max(1, totalFrames), targetRate);
        const merged = offline.createBuffer(targetChannels, Math.max(1, totalFrames), targetRate);
        for (let c = 0; c < targetChannels; c++) {
          const dest = merged.getChannelData(c);
          let pos = 0;
          for (const buf of normalized) {
            dest.set(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), pos);
            pos += buf.length;
          }
        }
        const wavBytes = encodeWavFromAudioBuffer(merged);
        const blob = toBinaryBlob(wavBytes, 'audio/wav');
        return {
          files: [{ blob, filename: 'merged-audio.wav', mimeType: 'audio/wav', size: blob.size }],
          outputFilename: 'merged-audio.wav',
          outputMimeType: 'audio/wav',
          summaryLines: [
            `Merged ${files.length} audio tracks (${merged.duration.toFixed(2)}s · ${targetRate} Hz)`,
          ],
          originalTotalBytes: totalOriginal,
          outputTotalBytes: blob.size,
        };
      }

      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());

      if (slug === 'mp3-to-wav' || slug === 'video-to-wav') {
        const wavBytes = encodeWavFromAudioBuffer(decoded);
        const blob = toBinaryBlob(wavBytes, 'audio/wav');
        const filename = replaceExtension(file.name, 'wav');
        return {
          files: [{ blob, filename, mimeType: 'audio/wav', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/wav',
          summaryLines: [
            `Extracted/decoded ${decoded.duration.toFixed(2)}s PCM WAV (${decoded.sampleRate} Hz · ${decoded.numberOfChannels} ch)`,
          ],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }

      if (
        slug === 'wav-to-mp3' ||
        slug === 'm4a-to-mp3' ||
        slug === 'flac-to-mp3' ||
        slug === 'ogg-to-mp3' ||
        slug === 'aac-to-mp3' ||
        slug === 'video-to-mp3' ||
        slug === 'audio-metadata-editor'
      ) {
        let mp3Bytes = await encodeMp3FromAudioBuffer(decoded, 128);
        if (slug === 'audio-metadata-editor') {
          mp3Bytes = applyId3v2Metadata(mp3Bytes, {
            title: options.audioTitle || file.name,
            artist: options.audioArtist || 'Unknown Artist',
            album: options.audioAlbum || 'NexcTool Audio',
          });
        }
        const blob = toBinaryBlob(mp3Bytes, 'audio/mpeg');
        const filename = replaceExtension(file.name, 'mp3');
        return {
          files: [{ blob, filename, mimeType: 'audio/mpeg', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/mpeg',
          summaryLines: [
            `Encoded ${decoded.duration.toFixed(2)}s audio to 128 kbps MP3 (${formatBytes(blob.size)})`,
          ],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }

      if (slug === 'audio-trimmer') {
        const startSec = Math.max(0, Math.min(decoded.duration - 0.05, options.trimStartSec ?? 0));
        const rawEnd = options.trimEndSec && options.trimEndSec > startSec ? options.trimEndSec : decoded.duration;
        const endSec = Math.min(decoded.duration, rawEnd);
        const startSample = Math.floor(startSec * decoded.sampleRate);
        const endSample = Math.max(startSample + 1, Math.floor(endSec * decoded.sampleRate));
        const length = endSample - startSample;
        const channels: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          channels.push(decoded.getChannelData(c).subarray(startSample, endSample));
        }
        const wavBytes = encodeWavBufferWithMeta(channels, decoded.sampleRate);
        const blob = toBinaryBlob(wavBytes, 'audio/wav');
        const filename = replaceExtension(file.name, 'trimmed.wav');
        return {
          files: [{ blob, filename, mimeType: 'audio/wav', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/wav',
          summaryLines: [
            `Trimmed ${startSec.toFixed(2)}s → ${endSec.toFixed(2)}s (${(length / decoded.sampleRate).toFixed(2)}s output)`,
          ],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }

      if (slug === 'audio-volume-changer') {
        const pct = Math.min(300, Math.max(10, options.volumePercent ?? 150));
        const gain = pct / 100;
        const channels: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const src = decoded.getChannelData(c);
          const out = new Float32Array(src.length);
          for (let i = 0; i < src.length; i++) {
            out[i] = Math.max(-1, Math.min(1, src[i] * gain));
          }
          channels.push(out);
        }
        const wavBytes = encodeWavBufferWithMeta(channels, decoded.sampleRate);
        const blob = toBinaryBlob(wavBytes, 'audio/wav');
        const filename = replaceExtension(file.name, `vol-${pct}.wav`);
        return {
          files: [{ blob, filename, mimeType: 'audio/wav', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/wav',
          summaryLines: [`Adjusted audio gain to ${pct}% (${decoded.duration.toFixed(2)}s)`],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }

      if (slug === 'audio-speed-changer') {
        const factor = Math.min(3, Math.max(0.5, options.speedFactor ?? 1.5));
        const targetFrames = Math.max(1, Math.ceil(decoded.length / factor));
        const offline = new OfflineAudioContext(decoded.numberOfChannels, targetFrames, decoded.sampleRate);
        const src = offline.createBufferSource();
        src.buffer = decoded;
        src.playbackRate.value = factor;
        src.connect(offline.destination);
        src.start(0);
        const rendered = await offline.startRendering();
        const wavBytes = encodeWavFromAudioBuffer(rendered);
        const blob = toBinaryBlob(wavBytes, 'audio/wav');
        const filename = replaceExtension(file.name, `${factor}x.wav`);
        return {
          files: [{ blob, filename, mimeType: 'audio/wav', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/wav',
          summaryLines: [
            `Changed playback speed to ${factor}× (${decoded.duration.toFixed(2)}s → ${rendered.duration.toFixed(2)}s)`,
          ],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }

      if (slug === 'audio-silence-remover') {
        const cleaned = removeSilentWindows(decoded);
        const wavBytes = encodeWavFromAudioBuffer(cleaned);
        const blob = toBinaryBlob(wavBytes, 'audio/wav');
        const filename = replaceExtension(file.name, 'nosilence.wav');
        const trimmedSec = Math.max(0, decoded.duration - cleaned.duration);
        return {
          files: [{ blob, filename, mimeType: 'audio/wav', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/wav',
          summaryLines: [
            `Removed ${trimmedSec.toFixed(2)}s of dead silence (${decoded.duration.toFixed(2)}s → ${cleaned.duration.toFixed(2)}s)`,
          ],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }

      if (slug === 'audio-compressor') {
        const offline = new OfflineAudioContext(
          decoded.numberOfChannels,
          decoded.length,
          decoded.sampleRate
        );
        const src = offline.createBufferSource();
        src.buffer = decoded;
        const comp = offline.createDynamicsCompressor();
        comp.threshold.value = -24;
        comp.knee.value = 20;
        comp.ratio.value = 6;
        comp.attack.value = 0.005;
        comp.release.value = 0.2;
        src.connect(comp);
        comp.connect(offline.destination);
        src.start(0);
        const compressedBuf = await offline.startRendering();
        const mp3Bytes = await encodeMp3FromAudioBuffer(compressedBuf, 96);
        const blob = toBinaryBlob(mp3Bytes, 'audio/mpeg');
        const filename = replaceExtension(file.name, 'compressed.mp3');
        const savedPct = calculateSavingsPercent(file.size, blob.size);
        return {
          files: [{ blob, filename, mimeType: 'audio/mpeg', size: blob.size }],
          outputFilename: filename,
          outputMimeType: 'audio/mpeg',
          summaryLines: [
            `Applied dynamic compression + 96 kbps MP3 encoding`,
            `${formatBytes(file.size)} → ${formatBytes(blob.size)}${savedPct > 0 ? ` (${savedPct}% smaller)` : ''}`,
          ],
          originalTotalBytes: file.size,
          outputTotalBytes: blob.size,
        };
      }
    } finally {
      await ctx.close();
    }
  }

  // 2. GIF -> Video (MP4 / WebM)
  if (slug === 'gif-to-mp4') {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.style.position = 'fixed';
    img.style.left = '-9999px';
    document.body.appendChild(img);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Unable to decode GIF image.'));
      });
      const w = Math.max(2, Math.round((img.naturalWidth || 480) / 2) * 2);
      const h = Math.max(2, Math.round((img.naturalHeight || 320) / 2) * 2);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      const chosen = pickSupportedVideoMime(true, false);
      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType: chosen.mime, videoBitsPerSecond: 1_200_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((res) => {
        recorder.onstop = () => res(new Blob(chunks, { type: chosen.mime.split(';')[0] }));
      });
      recorder.start(150);

      let active = true;
      const pump = () => {
        if (!active) return;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        requestAnimationFrame(pump);
      };
      pump();
      await new Promise((r) => setTimeout(r, 2500));
      active = false;
      recorder.stop();
      const outBlob = await done;
      const filename = replaceExtension(file.name, chosen.ext);
      return {
        files: [{ blob: outBlob, filename, mimeType: chosen.mime.split(';')[0], size: outBlob.size }],
        outputFilename: filename,
        outputMimeType: chosen.mime.split(';')[0],
        summaryLines: [`Captured 2.5s animated video (${w}×${h} · .${chosen.ext.toUpperCase()})`],
        originalTotalBytes: file.size,
        outputTotalBytes: outBlob.size,
      };
    } finally {
      img.remove();
      URL.revokeObjectURL(url);
    }
  }

  // 3. Video -> Animated GIF
  if (slug === 'video-to-gif') {
    const { video, cleanup } = await loadVideoMetadata(file);
    try {
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(4, video.duration) : 2.5;
      const frameCount = 14;
      const maxW = 320;
      const natW = video.videoWidth || 480;
      const natH = video.videoHeight || 270;
      const w = Math.min(maxW, natW);
      const h = Math.max(2, Math.round((natH / natW) * w));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      const frames: { rgba: Uint8ClampedArray; delayCs: number }[] = [];
      for (let i = 0; i < frameCount; i++) {
        video.currentTime = (dur * i) / frameCount;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
          setTimeout(res, 250);
        });
        ctx.drawImage(video, 0, 0, w, h);
        frames.push({
          rgba: ctx.getImageData(0, 0, w, h).data,
          delayCs: Math.max(8, Math.round((dur / frameCount) * 100)),
        });
      }

      const gifBytes = encodeAnimatedGif(frames, w, h);
      const blob = toBinaryBlob(gifBytes, 'image/gif');
      const filename = replaceExtension(file.name, 'gif');
      const previewDataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.readAsDataURL(blob);
      });

      return {
        files: [{ blob, filename, mimeType: 'image/gif', size: blob.size }],
        outputFilename: filename,
        outputMimeType: 'image/gif',
        previewDataUrl,
        summaryLines: [`Encoded ${frames.length}-frame animated GIF (${w}×${h}, ${dur.toFixed(1)}s clip)`],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    } finally {
      cleanup();
    }
  }

  // 4. Canvas + MediaRecorder Video Transforms
  if (
    slug === 'mp4-to-webm' ||
    slug === 'webm-to-mp4' ||
    slug === 'mov-to-mp4' ||
    slug === 'video-compressor' ||
    slug === 'video-resizer' ||
    slug === 'video-trimmer' ||
    slug === 'video-speed-changer' ||
    slug === 'video-rotator' ||
    slug === 'video-audio-remover' ||
    slug === 'video-merger'
  ) {
    if (slug === 'video-merger' && files.length < 2) {
      throw new Error('Please select at least 2 videos to merge.');
    }
    const q = Math.min(95, Math.max(10, options.quality ?? 70));
    const isWebmInput = file.name.toLowerCase().endsWith('.webm') || file.type === 'video/webm';
    const preferMp4 =
      slug === 'webm-to-mp4' ||
      slug === 'mov-to-mp4' ||
      (slug === 'video-compressor' && !isWebmInput);

    const result = await transcodeVideosViaCanvas(files, {
      preferMp4,
      targetWidth: slug === 'video-resizer' ? options.width : undefined,
      targetHeight: slug === 'video-resizer' ? options.height : undefined,
      rotationDeg: slug === 'video-rotator' ? (options.rotation ?? 90) : 0,
      trimStartSec: slug === 'video-trimmer' ? options.trimStartSec : undefined,
      trimEndSec: slug === 'video-trimmer' ? options.trimEndSec : undefined,
      speedFactor: slug === 'video-speed-changer' ? options.speedFactor : 1,
      videoBitsPerSecond: 1_800_000,
      compressQuality: slug === 'video-compressor' ? q : undefined,
      stripAudio: slug === 'video-audio-remover',
    });

    const filename =
      slug === 'video-merger'
        ? `merged-video.${result.ext}`
        : slug === 'video-compressor'
          ? replaceExtension(file.name, `compressed.${result.ext}`)
          : replaceExtension(
              file.name,
              `${slug === 'mp4-to-webm' || slug === 'webm-to-mp4' || slug === 'mov-to-mp4' ? '' : `${slug.replace('video-', '')}.`}${result.ext}`.replace(/^\./, '')
            );
    const totalOrig = files.reduce((a, f) => a + f.size, 0);
    const savedPct = calculateSavingsPercent(totalOrig, result.blob.size);
    return {
      files: [{ blob: result.blob, filename, mimeType: result.mime, size: result.blob.size }],
      outputFilename: filename,
      outputMimeType: result.mime,
      summaryLines: [
        `Rendered ${result.width}×${result.height} .${result.ext.toUpperCase()} locally in browser`,
        `${formatBytes(totalOrig)} → ${formatBytes(result.blob.size)}${savedPct > 0 ? ` (${savedPct}% smaller)` : ''}`,
      ],
      originalTotalBytes: totalOrig,
      outputTotalBytes: result.blob.size,
    };
  }

  // 5. Video Thumbnail / Frame / Metadata (fast seek capture)
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('This video codec is not supported by your browser.'));
    });

    if (slug === 'video-metadata-viewer') {
      const report = [
        `File name: ${file.name}`,
        `File size: ${formatBytes(file.size)}`,
        `MIME type: ${file.type || 'unknown'}`,
        `Resolution: ${video.videoWidth} × ${video.videoHeight}`,
        `Duration: ${Number.isFinite(video.duration) ? `${video.duration.toFixed(2)} seconds` : 'unknown'}`,
      ].join('\n');
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const filename = replaceExtension(file.name, 'metadata.txt');
      return {
        files: [{ blob, filename, mimeType: 'text/plain', size: blob.size }],
        textOutput: report,
        outputFilename: filename,
        summaryLines: [`${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)}s`],
      };
    }

    const seekTarget = Math.min(1, Math.max(0, (video.duration || 1) * 0.1));
    video.currentTime = seekTarget;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      setTimeout(resolve, 400);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to capture video frame.'))), 'image/png');
    });
    const filename = replaceExtension(file.name, 'thumbnail.png');
    return {
      files: [{ blob, filename, mimeType: 'image/png', size: blob.size }],
      outputFilename: filename,
      outputMimeType: 'image/png',
      previewDataUrl: canvas.toDataURL('image/png'),
      summaryLines: [`Captured ${canvas.width}×${canvas.height} PNG frame at ${seekTarget.toFixed(2)}s`],
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
