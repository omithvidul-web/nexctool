import { useEffect, useRef, useState } from 'react';
import { Download, Music, Play, Square } from 'lucide-react';
import { decodeAudioBufferResilient } from '../../processors/mediaProcessor';
import { unlockSharedAudioContext } from '../../utils/audioUnlock';
import { encodeChannelsToMp3, sliceAndFadeChannels } from '../../utils/audioFadeHelper';
import { encodeWavBufferWithMeta } from '../../utils/id3Helper';
import { formatBytes } from '../../utils/formatters';

export function RingtoneMakerTool() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(30);
  const [fadeInSec, setFadeInSec] = useState(1.5);
  const [fadeOutSec, setFadeOutSec] = useState(2.0);
  const [gainPct, setGainPct] = useState(100);
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      previewSourceRef.current = null;
    }
    setPreviewPlaying(false);
  };

  useEffect(() => {
    return () => stopPreview();
  }, []);

  // Draw waveform + trimmed region + fade curves
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !audioBuffer || durationSec <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const data = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const startX = Math.round((startSec / durationSec) * w);
    const endX = Math.round((endSec / durationSec) * w);

    // Highlight active ringtone selection
    ctx.fillStyle = 'rgba(79, 70, 229, 0.25)';
    ctx.fillRect(startX, 0, Math.max(2, endX - startX), h);

    // Draw waveform bars
    const midY = h / 2;
    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = -1;
      const offset = x * step;
      for (let i = 0; i < step && offset + i < data.length; i++) {
        const s = data[offset + i];
        if (s < min) min = s;
        if (s > max) max = s;
      }
      const inRange = x >= startX && x <= endX;
      ctx.fillStyle = inRange ? '#818CF8' : '#334155';
      const barTop = midY + min * (h * 0.44);
      const barH = Math.max(2, (max - min) * (h * 0.44));
      ctx.fillRect(x, barTop, 1.5, barH);
    }

    // Draw fade-in & fade-out envelope guide lines
    const selW = Math.max(1, endX - startX);
    const clipDur = Math.max(0.1, endSec - startSec);
    const fiW = Math.min(selW / 2, (fadeInSec / clipDur) * selW);
    const foW = Math.min(selW - fiW, (fadeOutSec / clipDur) * selW);

    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, h - 6);
    ctx.lineTo(startX + fiW, 8);
    ctx.lineTo(endX - foW, 8);
    ctx.lineTo(endX, h - 6);
    ctx.stroke();
  }, [audioBuffer, durationSec, startSec, endSec, fadeInSec, fadeOutSec]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    stopPreview();
    setError(null);
    const ctx = unlockSharedAudioContext() ?? new AudioContext();
    try {
      const buf = await decodeAudioBufferResilient(ctx, file);
      setAudioFile(file);
      setAudioBuffer(buf);
      const dur = Number(buf.duration.toFixed(2));
      setDurationSec(dur);
      setStartSec(0);
      setEndSec(Math.min(dur, 30));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to decode "${file.name}": ${err.message}`
          : 'Unable to decode this audio file.'
      );
    }
  };

  const buildProcessedChannels = () => {
    if (!audioBuffer) return null;
    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }
    const safeStart = Math.max(0, Math.min(durationSec - 0.1, startSec));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(durationSec, endSec));
    return {
      channels: sliceAndFadeChannels(
        channels,
        audioBuffer.sampleRate,
        safeStart,
        safeEnd,
        fadeInSec,
        fadeOutSec,
        gainPct / 100
      ),
      sampleRate: audioBuffer.sampleRate,
    };
  };

  const handleTogglePreview = async () => {
    if (previewPlaying) {
      stopPreview();
      return;
    }
    const processed = buildProcessedChannels();
    if (!processed || processed.channels.length === 0) return;

    const ctx = unlockSharedAudioContext() ?? new AudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    const playBuf = ctx.createBuffer(
      processed.channels.length,
      processed.channels[0].length,
      processed.sampleRate
    );
    processed.channels.forEach((ch, idx) => {
      playBuf.copyToChannel(new Float32Array(ch), idx);
    });

    const src = ctx.createBufferSource();
    src.buffer = playBuf;
    src.connect(ctx.destination);
    src.onended = () => {
      previewSourceRef.current = null;
      setPreviewPlaying(false);
    };
    previewSourceRef.current = src;
    setPreviewPlaying(true);
    src.start(0);
  };

  const handleDownload = async () => {
    const processed = buildProcessedChannels();
    if (!processed || processed.channels.length === 0 || !audioFile) return;

    setExporting(true);
    setError(null);
    try {
      const bytes =
        format === 'mp3'
          ? await encodeChannelsToMp3(processed.channels, processed.sampleRate, 192)
          : encodeWavBufferWithMeta(processed.channels, processed.sampleRate);

      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy.buffer], {
        type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dot = audioFile.name.lastIndexOf('.');
      const base = dot > 0 ? audioFile.name.slice(0, dot) : audioFile.name;
      a.href = url;
      a.download = `${base}-ringtone.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export ringtone.');
    } finally {
      setExporting(false);
    }
  };

  const clipDuration = Math.max(0, endSec - startSec);

  return (
    <div className="space-y-5">
      {/* Upload */}
      <label className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer">
        <Music className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {audioFile ? `Loaded: ${audioFile.name} (${formatBytes(audioFile.size)})` : 'Upload Audio Track (MP3, WAV, M4A, OGG, FLAC)'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Trim any section, apply smooth Fade-In & Fade-Out, and export as MP3 or WAV locally
          </div>
        </div>
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          className="sr-only"
          onChange={(e) => void handleUpload(e.target.files?.[0])}
        />
      </label>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {audioBuffer ? (
        <div className="space-y-5">
          {/* Waveform */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#0F172A] p-3 space-y-2">
            <div className="flex justify-between text-xs font-mono tabular-nums text-slate-300">
              <span>Selection: {startSec.toFixed(1)}s — {endSec.toFixed(1)}s ({clipDuration.toFixed(1)}s)</span>
              <span>Track Length: {durationSec.toFixed(1)}s</span>
            </div>
            <canvas ref={waveCanvasRef} width={760} height={130} className="w-full h-32 rounded-xl" />
          </div>

          {/* Sliders */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <label htmlFor="rt-start">Start (s)</label>
                <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{startSec.toFixed(1)}s</span>
              </div>
              <input
                id="rt-start"
                type="range"
                min={0}
                max={Math.max(0, endSec - 0.5)}
                step={0.1}
                value={startSec}
                onChange={(e) => setStartSec(Number(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <label htmlFor="rt-end">End (s)</label>
                <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{endSec.toFixed(1)}s</span>
              </div>
              <input
                id="rt-end"
                type="range"
                min={Math.min(durationSec, startSec + 0.5)}
                max={durationSec}
                step={0.1}
                value={endSec}
                onChange={(e) => setEndSec(Number(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <label htmlFor="rt-fi">Fade In</label>
                <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{fadeInSec.toFixed(1)}s</span>
              </div>
              <input
                id="rt-fi"
                type="range"
                min={0}
                max={5}
                step={0.2}
                value={fadeInSec}
                onChange={(e) => setFadeInSec(Number(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <label htmlFor="rt-fo">Fade Out</label>
                <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{fadeOutSec.toFixed(1)}s</span>
              </div>
              <input
                id="rt-fo"
                type="range"
                min={0}
                max={5}
                step={0.2}
                value={fadeOutSec}
                onChange={(e) => setFadeOutSec(Number(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <label htmlFor="rt-gain">Volume</label>
                <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{gainPct}%</span>
              </div>
              <input
                id="rt-gain"
                type="range"
                min={50}
                max={200}
                step={5}
                value={gainPct}
                onChange={(e) => setGainPct(Number(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
            </div>
          </div>

          {/* Format + Preview + Export */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Output Format:</span>
              {(['mp3', 'wav'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-3.5 py-1.5 text-xs font-semibold uppercase rounded-full cursor-pointer ${
                    format === fmt
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleTogglePreview()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold rounded-full cursor-pointer"
              >
                {previewPlaying ? <Square className="w-4 h-4 text-red-500" /> : <Play className="w-4 h-4 text-[#4F46E5]" />}
                <span>{previewPlaying ? 'Stop Preview' : 'Preview Ringtone'}</span>
              </button>

              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleDownload()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-xs cursor-pointer disabled:opacity-60"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>{exporting ? 'Encoding...' : `Download Ringtone (.${format.toUpperCase()})`}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-sm text-slate-500 dark:text-slate-400">
          Select an audio song or recording above to trim your custom ringtone with Fade-In &amp; Fade-Out.
        </div>
      )}
    </div>
  );
}
