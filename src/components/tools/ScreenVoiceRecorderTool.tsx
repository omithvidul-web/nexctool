import { useEffect, useRef, useState } from 'react';
import { Download, Mic, Monitor, Pause, Play, Square } from 'lucide-react';
import { attachSilentAudioKeepAlive, unlockSharedAudioContext } from '../../utils/audioUnlock';
import { getVideoMimeCandidates } from '../../utils/videoCompression';
import { encodeChannelsToMp3 } from '../../utils/audioFadeHelper';
import { encodeWavBufferWithMeta } from '../../utils/id3Helper';
import { formatBytes } from '../../utils/formatters';

type RecorderMode = 'screen' | 'voice';

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ScreenVoiceRecorderTool() {
  const [mode, setMode] = useState<RecorderMode>('screen');
  const [includeMic, setIncludeMic] = useState(true);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputExt, setOutputExt] = useState<string>('webm');
  const [convertingMp3, setConvertingMp3] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const cleanupKeepAliveRef = useRef<(() => void) | null>(null);

  const stopResources = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cleanupKeepAliveRef.current) {
      cleanupKeepAliveRef.current();
      cleanupKeepAliveRef.current = null;
    }
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopResources();
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  const clearRecordedOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  const handleStartRecording = async () => {
    setError(null);
    clearRecordedOutput();
    chunksRef.current = [];
    setElapsedSec(0);

    if (typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder API is not supported in this browser.');
      return;
    }

    const audioCtx = unlockSharedAudioContext();

    try {
      if (mode === 'screen') {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          setError('Screen recording is not supported in this browser.');
          return;
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: includeSystemAudio,
        });
        streamsRef.current.push(displayStream);

        let micStream: MediaStream | null = null;
        if (includeMic && navigator.mediaDevices?.getUserMedia) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamsRef.current.push(micStream);
          } catch {
            // Continue without mic if permission denied
          }
        }

        const mixedStream = new MediaStream();
        displayStream.getVideoTracks().forEach((t) => mixedStream.addTrack(t));

        const hasDisplayAudio = displayStream.getAudioTracks().length > 0;
        const hasMicAudio = (micStream?.getAudioTracks().length ?? 0) > 0;

        if (audioCtx && (hasDisplayAudio || hasMicAudio)) {
          const dest = audioCtx.createMediaStreamDestination();
          const keepAlive = attachSilentAudioKeepAlive(audioCtx, dest);
          cleanupKeepAliveRef.current = keepAlive.cleanup;

          if (hasDisplayAudio) {
            const sysSrc = audioCtx.createMediaStreamSource(
              new MediaStream(displayStream.getAudioTracks())
            );
            sysSrc.connect(dest);
          }
          if (micStream && hasMicAudio) {
            const micSrc = audioCtx.createMediaStreamSource(micStream);
            micSrc.connect(dest);
          }
          dest.stream.getAudioTracks().forEach((t) => mixedStream.addTrack(t));
        }

        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = displayStream;
          await liveVideoRef.current.play().catch(() => {});
        }

        const hasAudio = mixedStream.getAudioTracks().length > 0;
        const candidates = getVideoMimeCandidates(false, hasAudio).filter((c) =>
          MediaRecorder.isTypeSupported(c.mime)
        );
        const picked = candidates[0];
        const recorder = picked
          ? new MediaRecorder(mixedStream, { mimeType: picked.mime, videoBitsPerSecond: 2_500_000 })
          : new MediaRecorder(mixedStream);
        const finalMime = recorder.mimeType || picked?.mime || 'video/webm';
        const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: finalMime });
          const url = URL.createObjectURL(blob);
          setOutputBlob(blob);
          setOutputExt(ext);
          setOutputUrl(url);
          setRecordingState('idle');
          stopResources();
        };

        // Stop automatically if user clicks browser "Stop sharing" banner
        displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (recorder.state !== 'inactive') recorder.stop();
        });

        recorderRef.current = recorder;
        recorder.start(250);
      } else {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Microphone recording is not supported in this browser.');
          return;
        }
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamsRef.current.push(micStream);

        // Live waveform visualizer
        if (audioCtx && waveCanvasRef.current) {
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          const src = audioCtx.createMediaStreamSource(micStream);
          src.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const drawWave = () => {
            const canvas = waveCanvasRef.current;
            if (!canvas || streamsRef.current.length === 0) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            analyser.getByteTimeDomainData(dataArr);
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#818CF8';
            ctx.beginPath();
            const sliceW = canvas.width / dataArr.length;
            for (let i = 0; i < dataArr.length; i++) {
              const v = dataArr[i] / 128.0;
              const y = (v * canvas.height) / 2;
              if (i === 0) ctx.moveTo(0, y);
              else ctx.lineTo(i * sliceW, y);
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
            rafRef.current = requestAnimationFrame(drawWave);
          };
          rafRef.current = requestAnimationFrame(drawWave);
        }

        const audioCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
        const supported = audioCandidates.find((m) => MediaRecorder.isTypeSupported(m));
        const recorder = supported
          ? new MediaRecorder(micStream, { mimeType: supported })
          : new MediaRecorder(micStream);
        const finalMime = recorder.mimeType || supported || 'audio/webm';
        const ext = finalMime.includes('mp4') ? 'm4a' : finalMime.includes('ogg') ? 'ogg' : 'webm';

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: finalMime });
          const url = URL.createObjectURL(blob);
          setOutputBlob(blob);
          setOutputExt(ext);
          setOutputUrl(url);
          setRecordingState('idle');
          stopResources();
        };

        recorderRef.current = recorder;
        recorder.start(250);
      }

      setRecordingState('recording');
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      stopResources();
      setError(
        err instanceof Error
          ? `Permission denied or capture unavailable: ${err.message}`
          : 'Unable to start recording.'
      );
    }
  };

  const handleTogglePause = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingState('paused');
    } else if (rec.state === 'paused') {
      rec.resume();
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
      setRecordingState('recording');
    }
  };

  const handleStopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    } else {
      stopResources();
      setRecordingState('idle');
    }
  };

  const handleExportVoiceFormat = async (target: 'mp3' | 'wav') => {
    if (!outputBlob) return;
    setConvertingMp3(true);
    setError(null);
    try {
      const ctx = unlockSharedAudioContext() ?? new AudioContext();
      const decoded = await ctx.decodeAudioData(await outputBlob.arrayBuffer());
      const channels: Float32Array[] = [];
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        channels.push(decoded.getChannelData(c));
      }
      const bytes =
        target === 'mp3'
          ? await encodeChannelsToMp3(channels, decoded.sampleRate, 192)
          : encodeWavBufferWithMeta(channels, decoded.sampleRate);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const outBlob = new Blob([copy.buffer], {
        type: target === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      });
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexctool-voice.${target}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to export ${target.toUpperCase()}.`);
    } finally {
      setConvertingMp3(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Mode Switcher */}
      <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-1 gap-1">
        <button
          type="button"
          disabled={recordingState !== 'idle'}
          onClick={() => {
            clearRecordedOutput();
            setMode('screen');
          }}
          className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 ${
            mode === 'screen'
              ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          <Monitor className="w-4 h-4" aria-hidden="true" />
          <span>Screen Recorder</span>
        </button>
        <button
          type="button"
          disabled={recordingState !== 'idle'}
          onClick={() => {
            clearRecordedOutput();
            setMode('voice');
          }}
          className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 ${
            mode === 'voice'
              ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          <Mic className="w-4 h-4" aria-hidden="true" />
          <span>Voice Recorder</span>
        </button>
      </div>

      {/* Options */}
      {mode === 'screen' && recordingState === 'idle' && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap gap-5">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSystemAudio}
              onChange={(e) => setIncludeSystemAudio(e.target.checked)}
              className="accent-[#4F46E5]"
            />
            <span>Capture Tab / System Audio</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMic}
              onChange={(e) => setIncludeMic(e.target.checked)}
              className="accent-[#4F46E5]"
            />
            <span>Include Microphone Audio</span>
          </label>
        </div>
      )}

      {/* Controls & Timer */}
      <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {recordingState === 'idle' ? (
            <button
              type="button"
              onClick={handleStartRecording}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {mode === 'screen' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{mode === 'screen' ? 'Start Screen Capture' : 'Start Voice Recording'}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTogglePause}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold rounded-full cursor-pointer"
              >
                {recordingState === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{recordingState === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-full cursor-pointer"
              >
                <Square className="w-4 h-4" aria-hidden="true" />
                <span>Stop &amp; Save</span>
              </button>
            </>
          )}
        </div>

        <div className="font-mono tabular-nums text-lg font-bold text-slate-800 dark:text-slate-100">
          {recordingState !== 'idle' ? (recordingState === 'paused' ? 'PAUSED · ' : 'REC · ') : ''}
          {formatElapsed(elapsedSec)}
        </div>
      </div>

      {/* Live Preview */}
      {recordingState !== 'idle' && mode === 'screen' && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-black">
          <video ref={liveVideoRef} muted playsInline className="w-full max-h-80 object-contain" />
        </div>
      )}

      {recordingState !== 'idle' && mode === 'voice' && (
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#0F172A] p-2">
          <canvas ref={waveCanvasRef} width={720} height={120} className="w-full h-28 rounded-xl" />
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Playback & Download */}
      {outputUrl && outputBlob && (
        <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <span>Recording Ready</span>
            <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
              {formatElapsed(elapsedSec)} · {formatBytes(outputBlob.size)}
            </span>
          </div>

          {mode === 'screen' ? (
            <video src={outputUrl} controls playsInline className="w-full max-h-80 rounded-xl bg-black" />
          ) : (
            <audio src={outputUrl} controls className="w-full" />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={outputUrl}
              download={`nexctool-${mode}-recording.${outputExt}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-xs"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download .{outputExt.toUpperCase()}</span>
            </a>

            {mode === 'voice' && (
              <>
                <button
                  type="button"
                  disabled={convertingMp3}
                  onClick={() => void handleExportVoiceFormat('mp3')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-semibold rounded-full cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>{convertingMp3 ? 'Encoding...' : 'Export as MP3'}</span>
                </button>
                <button
                  type="button"
                  disabled={convertingMp3}
                  onClick={() => void handleExportVoiceFormat('wav')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold rounded-full cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Export as WAV</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
