import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileUp } from 'lucide-react';
import {
  formatSubtitles,
  parseSubtitles,
  SAMPLE_SRT_SUBTITLE,
  shiftSubtitleCues,
  type SubtitleFormat,
} from '../../utils/subtitleHelper';

export function SubtitleTool() {
  const [rawInput, setRawInput] = useState(SAMPLE_SRT_SUBTITLE);
  const [targetFormat, setTargetFormat] = useState<SubtitleFormat>('vtt');
  const [shiftSeconds, setShiftSeconds] = useState<number>(0);
  const [includeTimestampsTxt, setIncludeTimestampsTxt] = useState(true);
  const [copied, setCopied] = useState(false);

  const parsedCues = useMemo(() => parseSubtitles(rawInput), [rawInput]);
  const shiftedCues = useMemo(
    () => shiftSubtitleCues(parsedCues, Math.round(shiftSeconds * 1000)),
    [parsedCues, shiftSeconds]
  );
  const convertedOutput = useMemo(
    () => formatSubtitles(shiftedCues, targetFormat, includeTimestampsTxt),
    [shiftedCues, targetFormat, includeTimestampsTxt]
  );

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setRawInput(text);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.vtt')) setTargetFormat('srt');
    else if (lower.endsWith('.srt')) setTargetFormat('vtt');
  };

  const handleCopy = async () => {
    if (!convertedOutput) return;
    try {
      await navigator.clipboard.writeText(convertedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    if (!convertedOutput) return;
    const mime =
      targetFormat === 'vtt'
        ? 'text/vtt;charset=utf-8'
        : 'text/plain;charset=utf-8';
    const blob = new Blob([convertedOutput], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles.${targetFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Output Format
            </span>
            <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
              {(['srt', 'vtt', 'txt'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setTargetFormat(fmt)}
                  className={`px-4 py-1 text-xs font-semibold uppercase rounded-full cursor-pointer ${
                    targetFormat === fmt
                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="sub-shift" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Time Shift (seconds, +/-)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShiftSeconds((s) => Number((s - 0.5).toFixed(2)))}
                className="px-2.5 h-9 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer"
              >
                -0.5s
              </button>
              <input
                id="sub-shift"
                type="number"
                step="0.1"
                value={shiftSeconds}
                onChange={(e) => setShiftSeconds(Number(e.target.value) || 0)}
                className="w-24 h-9 px-2.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShiftSeconds((s) => Number((s + 0.5).toFixed(2)))}
                className="px-2.5 h-9 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer"
              >
                +0.5s
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {targetFormat === 'txt' && (
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer mr-2">
              <input
                type="checkbox"
                checked={includeTimestampsTxt}
                onChange={(e) => setIncludeTimestampsTxt(e.target.checked)}
                className="accent-[#4F46E5]"
              />
              <span>Keep Timestamps</span>
            </label>
          )}
          <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] cursor-pointer">
            <FileUp className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <span>Upload .SRT / .VTT</span>
            <input
              type="file"
              accept=".srt,.vtt,.txt"
              className="sr-only"
              onChange={(e) => void handleFileUpload(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {/* Split Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Input Subtitles (SRT or WebVTT)</span>
            <span className="font-mono tabular-nums text-slate-500">{parsedCues.length} cues detected</span>
          </div>
          <textarea
            rows={13}
            aria-label="Input subtitles"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Paste .srt or .vtt subtitle content here..."
            className="w-full p-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#4F46E5]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Converted Output (.{targetFormat.toUpperCase()})</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!convertedOutput}
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                disabled={!convertedOutput}
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-full text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                <span>Download .{targetFormat}</span>
              </button>
            </div>
          </div>
          <textarea
            rows={13}
            readOnly
            aria-label="Converted subtitle output"
            value={convertedOutput}
            placeholder="Parsed and time-shifted subtitles will appear here..."
            className="w-full p-3.5 text-xs font-mono bg-slate-100/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
    </div>
  );
}
