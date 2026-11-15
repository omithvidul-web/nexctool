import { useEffect, useState } from 'react';
import { Download, Film, Video } from 'lucide-react';
import {
  createSafeMediaRecorder,
  loadVideoMetadata,
  tryDecodeVideoAudio,
} from '../../processors/mediaProcessor';
import { attachSilentAudioKeepAlive, unlockSharedAudioContext } from '../../utils/audioUnlock';
import { computeSocialVideoDrawRect } from '../../utils/audioFadeHelper';
import { formatBytes, replaceExtension } from '../../utils/formatters';

interface AspectPreset {
  id: '9:16' | '1:1' | '4:5' | '16:9';
  label: string;
  sublabel: string;
  width: number;
  height: number;
}

const PRESETS: AspectPreset[] = [
  { id: '9:16', label: '9:16 Vertical', sublabel: 'Reels / TikTok / Shorts', width: 720, height: 1280 },
  { id: '1:1', label: '1:1 Square', sublabel: 'Instagram / Feed', width: 1080, height: 1080 },
  { id: '4:5', label: '4:5 Portrait', sublabel: 'Social Post', width: 864, height: 1080 },
  { id: '16:9', label: '16:9 Widescreen', sublabel: 'YouTube', width: 1280, height: 720 },
];

type BgMode = 'blur' | 'color' | 'crop';

export function SocialVideoResizerTool() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<AspectPreset['id']>('9:16');
  const [bgMode, setBgMode] = useState<BgMode>('blur');
  const [bgColor, setBgColor] = useState('#0F172A');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState('social-video.mp4');
  const [outputSize, setOutputSize] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [sourceUrl, outputUrl]);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    setVideoFile(file);
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }
    const nextUrl = URL.createObjectURL(file);
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  };

  const handleExport = async () => {
    if (!videoFile) return;
    // Synchronous iOS/Safari AudioContext unlock inside user click gesture
    const audioCtx = unlockSharedAudioContext();

    setProcessing(true);
    setError(null);
    setProgress(5);
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }

    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
    const { video, cleanup } = await loadVideoMetadata(videoFile).catch((err) => {
      setProcessing(false);
      setError(err instanceof Error ? err.message : 'Unable to load video.');
      throw err;
    });

    let keepAliveCleanup: (() => void) | null = null;
    let bufferSrc: AudioBufferSourceNode | null = null;
    let backupDrawTimer: number | null = null;

    try {
      const srcW = video.videoWidth || 1280;
      const srcH = video.videoHeight || 720;
      const dstW = preset.width;
      const dstH = preset.height;

      const canvas = document.createElement('canvas');
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      const fgRect = computeSocialVideoDrawRect(
        srcW,
        srcH,
        dstW,
        dstH,
        bgMode === 'crop' ? 'cover' : 'contain'
      );
      const bgRect = computeSocialVideoDrawRect(srcW, srcH, dstW, dstH, 'cover');

      const drawFrame = () => {
        if (bgMode === 'blur') {
          ctx.save();
          ctx.filter = 'blur(26px) brightness(0.72)';
          ctx.drawImage(video, bgRect.dx, bgRect.dy, bgRect.dw, bgRect.dh);
          ctx.restore();
        } else if (bgMode === 'color') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, dstW, dstH);
        }
        ctx.drawImage(video, fgRect.dx, fgRect.dy, fgRect.dw, fgRect.dh);
      };

      drawFrame();

      const canvasStream = canvas.captureStream(30);
      const videoOnlyStream = new MediaStream(canvasStream.getVideoTracks());
      const combinedStream = new MediaStream(canvasStream.getVideoTracks());

      let hasAudio = false;
      const decodedAudio = await tryDecodeVideoAudio(audioCtx, videoFile);
      let startAudioFn: (() => void) | null = null;

      if (audioCtx) {
        const audioDest = audioCtx.createMediaStreamDestination();
        const keepAlive = attachSilentAudioKeepAlive(audioCtx, audioDest);
        keepAliveCleanup = keepAlive.cleanup;

        if (decodedAudio) {
          hasAudio = true;
          startAudioFn = () => {
            if (audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }
            bufferSrc = audioCtx.createBufferSource();
            bufferSrc.buffer = decodedAudio;
            bufferSrc.connect(audioDest);
            bufferSrc.start(0);
          };
          audioDest.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
        } else {
          // Live media element audio fallback
          try {
            video.muted = false;
            video.defaultMuted = false;
            video.volume = 1;
            const elemSrc = audioCtx.createMediaElementSource(video);
            elemSrc.connect(audioDest);
            hasAudio = true;
            audioDest.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
          } catch {
            video.muted = true;
          }
        }
      }

      const { recorder, mime, ext } = createSafeMediaRecorder(
        combinedStream,
        videoOnlyStream,
        true,
        hasAudio,
        2_500_000,
        128_000
      );

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const donePromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime });
          if (blob.size === 0) {
            reject(new Error('Browser recorded an empty video stream.'));
            return;
          }
          resolve(blob);
        };
        recorder.onerror = () => reject(new Error('Browser video encoder failed.'));
      });

      video.currentTime = 0;
      const totalDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;

      recorder.start(200);
      if (startAudioFn) startAudioFn();
      await video.play();

      const pump = () => {
        if (video.paused || video.ended) return;
        drawFrame();
        setProgress(Math.min(96, Math.max(8, Math.round((video.currentTime / totalDur) * 92))));
        requestAnimationFrame(pump);
      };
      requestAnimationFrame(pump);
      backupDrawTimer = window.setInterval(() => {
        if (!video.paused && !video.ended) drawFrame();
      }, 33);

      await new Promise<void>((resolve) => {
        const finish = () => {
          video.removeEventListener('ended', finish);
          resolve();
        };
        video.addEventListener('ended', finish, { once: true });
        if (video.ended) finish();
      });

      drawFrame();
      await new Promise((r) => setTimeout(r, 150));
      if (recorder.state !== 'inactive') recorder.stop();

      const outBlob = await donePromise;
      const nextUrl = URL.createObjectURL(outBlob);
      setOutputUrl(nextUrl);
      setOutputName(replaceExtension(videoFile.name, `${presetId.replace(':', 'x')}.${ext}`));
      setOutputSize(outBlob.size);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resize video.');
      setProgress(0);
    } finally {
      if (backupDrawTimer !== null) window.clearInterval(backupDrawTimer);
      if (bufferSrc) {
        try {
          (bufferSrc as AudioBufferSourceNode).stop();
        } catch {
          // ignore
        }
      }
      if (keepAliveCleanup) keepAliveCleanup();
      cleanup();
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Upload */}
      <label className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer">
        <Film className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {videoFile ? `Loaded: ${videoFile.name} (${formatBytes(videoFile.size)})` : 'Upload Video (MP4, MOV, WebM)'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Convert to 9:16 Reels/TikTok, 1:1 Square, or 4:5 Feed with blurred background & audio preserved
          </div>
        </div>
        <input
          type="file"
          accept="video/*,.mp4,.mov,.m4v,.webm"
          className="sr-only"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
      </label>

      {/* Aspect Ratio Presets */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Target Aspect Ratio
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={processing}
                onClick={() => setPresetId(p.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  presetId === p.id
                    ? 'border-[#4F46E5] bg-indigo-50/80 dark:bg-indigo-950/40 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="text-xs font-extrabold">{p.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.sublabel}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
              Padding Style:
            </span>
            {(
              [
                { id: 'blur', label: 'Blurred Video BG' },
                { id: 'color', label: 'Solid Color BG' },
                { id: 'crop', label: 'Center Crop (Fill)' },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={processing}
                onClick={() => setBgMode(b.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap ${
                  bgMode === b.id
                    ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {b.label}
              </button>
            ))}

            {bgMode === 'color' && (
              <input
                type="color"
                aria-label="Background fill color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
            )}
          </div>

          <button
            type="button"
            disabled={!videoFile || processing}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-400 text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Video className="w-4 h-4" aria-hidden="true" />
            <span>{processing ? 'Rendering Video...' : 'Resize & Export Video'}</span>
          </button>
        </div>
      </div>

      {processing && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Rendering padded video locally in your browser...</span>
            <span className="font-mono tabular-nums">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {outputUrl && (
        <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-4">
          <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
            <span>Resized Video Ready</span>
            <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
              {formatBytes(outputSize)}
            </span>
          </div>
          <video src={outputUrl} controls playsInline className="max-h-96 mx-auto rounded-xl bg-black" />
          <a
            href={outputUrl}
            download={outputName}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-xs"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download {outputName}</span>
          </a>
        </div>
      )}
    </div>
  );
}
