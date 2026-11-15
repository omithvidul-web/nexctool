import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const DeveloperPreviewTool = lazy(() =>
  import('../components/DeveloperPreviewTool').then((m) => ({
    default: m.DeveloperPreviewTool,
  }))
);
const InteractiveToolWorkspace = lazy(() =>
  import('../components/InteractiveToolWorkspace').then((m) => ({
    default: m.InteractiveToolWorkspace,
  }))
);
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  RefreshCw,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { getToolBySlug, getToolsByCategory } from '../data/tools';
import { buildToolSeoContent, calculateSavingsPercent, formatBytes, replaceExtension } from '../utils/formatters';
import { isToolPinned, recordRecentTool, togglePinnedTool } from '../utils/toolPreferences';
import { FileUploader } from '../components/FileUploader';
import { SeoHead } from '../components/SeoHead';
import { runToolProcessor } from '../processors/runTool';
import { SAMPLE_INPUTS } from '../processors/textProcessor';
import { unlockSharedAudioContext } from '../utils/audioUnlock';
import type { ProcessOptions, ProcessResult } from '../processors/types';

export function ToolPage() {
  const { toolSlug = '' } = useParams();
  const tool = getToolBySlug(toolSlug);

  const [files, setFiles] = useState<File[]>([]);
  const [textInput, setTextInput] = useState('');
  const [options, setOptions] = useState<ProcessOptions>({
    quality: 80,
    backgroundColor: '#FFFFFF',
    width: 1200,
    height: 0,
    maintainAspectRatio: true,
    rotation: 90,
    indent: 2,
    textMode: 'encode',
    regexPattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    regexFlags: 'g',
    splitSizeKb: 512,
    sizeValue: 25,
    sizeUnit: 'MB',
    cropAspect: '1:1',
    watermarkText: 'NexcTool',
    watermarkOpacity: 50,
    watermarkPosition: 'center',
    targetFormat: 'webp',
    pageRange: '1',
    pdfTitle: '',
    pdfAuthor: '',
    pdfSubject: '',
    csvSplitRows: 100,
    tolerance: 32,
    signatureText: 'Signed Digitally',
    formValues: '',
    trimStartSec: 0,
    trimEndSec: 10,
    volumePercent: 150,
    speedFactor: 1.5,
    audioTitle: '',
    audioArtist: '',
    audioAlbum: '',
    archiveTarget: 'zip',
    documentWatermark: 'CONFIDENTIAL',
  });

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [downloadUrls, setDownloadUrls] = useState<{ url: string; filename: string; size: number }[]>([]);
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [pinned, setPinned] = useState<boolean>(() => (toolSlug ? isToolPinned(toolSlug) : false));
  const [beforePreviewUrl, setBeforePreviewUrl] = useState<string | null>(null);

  // Reset state whenever navigating to a different tool slug
  useEffect(() => {
    setFiles([]);
    setTextInput('');
    setProcessing(false);
    setProgress(0);
    setError(null);
    setResult(null);
    setCopied(false);
    setZipping(false);
    setDownloadUrls((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  }, [toolSlug]);

  // Sync pin status & record recent tool visit
  useEffect(() => {
    if (!tool) return;
    setPinned(isToolPinned(tool.slug));
    recordRecentTool(tool.slug);
  }, [tool]);

  // Create and clean up Before preview object URL for uploaded images
  useEffect(() => {
    const firstFile = files[0];
    const isImageFile =
      firstFile &&
      (firstFile.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(firstFile.name));
    if (!isImageFile) {
      setBeforePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(firstFile);
    setBeforePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [files]);

  // Revoke object URLs on unmount or replacement
  useEffect(() => {
    return () => {
      downloadUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [downloadUrls]);

  const relatedTools = useMemo(() => {
    if (!tool) return [];
    return getToolsByCategory(tool.category)
      .filter((t) => t.slug !== tool.slug)
      .slice(0, 4);
  }, [tool]);

  if (!tool) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <SeoHead
          title="Tool Not Found - NexcTool"
          description="The requested file tool could not be found on NexcTool."
        />
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Tool not found
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Explore all 200+ free online file tools or browse by category.
        </p>
        <Link
          to="/all-tools"
          className="mt-6 inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:scale-[1.02] transition-all"
        >
          Browse All 200+ Tools
        </Link>
      </div>
    );
  }

  const seo = buildToolSeoContent(tool);
  const isComingSoon = tool.mode === 'coming-soon';
  const isTextOrFile = tool.mode === 'text-or-file';
  const sampleText = SAMPLE_INPUTS[tool.slug];

  const handleReset = () => {
    setFiles([]);
    setTextInput('');
    setError(null);
    setResult(null);
    setProgress(0);
    setCopied(false);
    setDownloadUrls((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  };

  const handleProcess = async () => {
    if (isComingSoon) return;
    if (tool.lazyGroup === 'media') {
      unlockSharedAudioContext();
    }
    setError(null);
    setResult(null);
    setCopied(false);
    setProcessing(true);
    setProgress(25);

    const progressTimer = window.setInterval(() => {
      setProgress((p) => (p < 85 ? p + 15 : p));
    }, 80);

    try {
      const processed = await runToolProcessor(tool, files, textInput, options);
      window.clearInterval(progressTimer);
      setProgress(100);

      const nextUrls = (processed.files ?? []).map((f) => ({
        url: URL.createObjectURL(f.blob),
        filename: f.filename,
        size: f.size,
      }));
      setDownloadUrls((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.url));
        return nextUrls;
      });
      setResult(processed);
    } catch (err) {
      window.clearInterval(progressTimer);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Unable to process this file in the browser.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyOutput = async () => {
    if (!result?.textOutput) return;
    try {
      await navigator.clipboard.writeText(result.textOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handleDownloadAllZip = async () => {
    if (!result?.files || result.files.length <= 1) return;
    setZipping(true);
    try {
      const { createZipBlob } = await import('../utils/zipHelper');
      const zipBlob = await createZipBlob(
        result.files.map((f) => ({ filename: f.filename, data: f.blob }))
      );
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = replaceExtension(tool.slug, 'zip');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ZIP archive.');
    } finally {
      setZipping(false);
    }
  };

  const canProcess =
    !isComingSoon &&
    !processing &&
    (files.length > 0 || (isTextOrFile && textInput.trim().length > 0) || tool.slug === 'file-size-converter');

  const savingsPct =
    result?.originalTotalBytes && result?.outputTotalBytes
      ? calculateSavingsPercent(result.originalTotalBytes, result.outputTotalBytes)
      : null;

  return (
    <>
      <SeoHead
        title={seo.titleTag}
        description={seo.metaDescription}
        faqs={seo.faqs}
        appName={tool.name}
      />

      {/* Top Header + Breadcrumb */}
      <section className="bg-white/70 dark:bg-[#0D1322] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-2.5"
          >
            <Link to="/" className="hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600" aria-hidden="true" />
            <Link to={`/category/${tool.category}`} className="hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors">
              {tool.categoryName}
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600" aria-hidden="true" />
            <span className="text-slate-900 dark:text-white font-semibold">{tool.name}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {tool.name}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                {tool.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const res = togglePinnedTool(tool.slug);
                setPinned(res.isPinned);
              }}
              aria-pressed={pinned}
              data-testid="pin-tool-button"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                pinned
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#4F46E5] dark:hover:border-indigo-400'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 ${pinned ? 'text-amber-500 fill-amber-400' : ''}`}
                aria-hidden="true"
              />
              <span>{pinned ? 'Pinned' : 'Pin Tool'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Tool Box */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-5 sm:p-7 shadow-[0_4px_20px_rgba(15,23,42,0.05)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] space-y-5">
          {/* Privacy Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
              Your file never leaves your device
            </span>
            <span>
              {tool.categoryName} · {isComingSoon ? 'Server version coming soon' : '100% Client-Side'}
            </span>
          </div>

          {tool.interactiveKind ? (
            <Suspense
              fallback={
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading interactive workspace...
                </div>
              }
            >
              <InteractiveToolWorkspace tool={tool} />
            </Suspense>
          ) : tool.previewKind ? (
            <Suspense
              fallback={
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading live preview workspace...
                </div>
              }
            >
              <DeveloperPreviewTool tool={tool} />
            </Suspense>
          ) : (
            <>
              {isComingSoon && (
                <div
                  role="status"
                  className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-sm"
                >
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="font-semibold">Server version coming soon</div>
                    <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
                      {tool.name} requires advanced format codecs that are not yet available purely in the browser. You can preview the workflow below while we finalize support.
                    </p>
                  </div>
                </div>
              )}

              {/* Uploader */}
              <FileUploader
                accept={tool.accept}
                multiple={tool.multiple}
                files={files}
                onFilesChange={(nextFiles) => {
                  setFiles(nextFiles);
                  setError(null);
                }}
              />

              {/* Text / Code Editor for text-or-file tools */}
              {isTextOrFile && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="tool-text-input" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Or paste text / code directly
                    </label>
                    {sampleText && (
                      <button
                        type="button"
                        onClick={() => {
                          setTextInput(sampleText);
                          setError(null);
                        }}
                        className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Load Sample Input
                      </button>
                    )}
                  </div>
                  <textarea
                    id="tool-text-input"
                    rows={7}
                    value={textInput}
                    onChange={(e) => {
                      setTextInput(e.target.value);
                      setError(null);
                    }}
                    placeholder={`Paste content for ${tool.name} here, or upload a file above...`}
                    className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* Contextual Options */}
              {!isComingSoon && tool.optionType && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Options</div>

                  {(tool.optionType === 'quality' || tool.optionType === 'background') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div>
                        <div className="flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                          <label htmlFor="opt-quality">Output Quality</label>
                          <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">
                            {options.quality}%
                          </span>
                        </div>
                        <input
                          id="opt-quality"
                          type="range"
                          min={10}
                          max={95}
                          step={5}
                          value={options.quality ?? 80}
                          onChange={(e) => setOptions((o) => ({ ...o, quality: Number(e.target.value) }))}
                          className="w-full accent-[#4F46E5]"
                        />
                      </div>

                      {tool.optionType === 'background' && (
                        <div>
                          <label htmlFor="opt-bg" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                            Transparent Background Fill
                          </label>
                          <div className="flex items-center gap-2.5">
                            <input
                              id="opt-bg"
                              type="color"
                              value={options.backgroundColor ?? '#FFFFFF'}
                              onChange={(e) => setOptions((o) => ({ ...o, backgroundColor: e.target.value }))}
                              className="w-10 h-9 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-white dark:bg-slate-900"
                            />
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                              {options.backgroundColor}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {tool.optionType === 'dimensions' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="opt-width" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Width (px)
                        </label>
                        <input
                          id="opt-width"
                          type="number"
                          min={1}
                          max={10000}
                          value={options.width ?? 1200}
                          onChange={(e) => setOptions((o) => ({ ...o, width: Number(e.target.value) }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-height" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Height (px, 0 = auto aspect ratio)
                        </label>
                        <input
                          id="opt-height"
                          type="number"
                          min={0}
                          max={10000}
                          value={options.height ?? 0}
                          onChange={(e) => setOptions((o) => ({ ...o, height: Number(e.target.value) }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'rotation' && (
                    <div>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Rotation Angle</span>
                      <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                        {([90, 180, 270] as const).map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => setOptions((o) => ({ ...o, rotation: deg }))}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                              options.rotation === deg
                                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'indent' && (
                    <div>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Formatting Style</span>
                      <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                        {[
                          { label: '2 Spaces', value: 2 as const },
                          { label: '4 Spaces', value: 4 as const },
                          { label: 'Minify', value: 0 as const },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setOptions((o) => ({ ...o, indent: opt.value }))}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                              options.indent === opt.value
                                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'text-mode' && (
                    <div>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Action Mode</span>
                      <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                        {(['encode', 'decode'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setOptions((o) => ({ ...o, textMode: m }))}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-full capitalize transition-all cursor-pointer ${
                              options.textMode === m
                                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'regex' && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3">
                        <label htmlFor="opt-regex" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Regular Expression Pattern
                        </label>
                        <input
                          id="opt-regex"
                          type="text"
                          value={options.regexPattern ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, regexPattern: e.target.value }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-flags" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Flags
                        </label>
                        <input
                          id="opt-flags"
                          type="text"
                          value={options.regexFlags ?? 'g'}
                          onChange={(e) => setOptions((o) => ({ ...o, regexFlags: e.target.value }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'split-size' && (
                    <div className="max-w-xs">
                      <label htmlFor="opt-split-kb" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Chunk Size (KB)
                      </label>
                      <input
                        id="opt-split-kb"
                        type="number"
                        min={1}
                        max={512000}
                        value={options.splitSizeKb ?? 512}
                        onChange={(e) => setOptions((o) => ({ ...o, splitSizeKb: Number(e.target.value) }))}
                        className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {tool.optionType === 'size-unit' && (
                    <div className="grid grid-cols-2 gap-3 max-w-sm">
                      <div>
                        <label htmlFor="opt-size-val" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Value
                        </label>
                        <input
                          id="opt-size-val"
                          type="number"
                          min={0}
                          value={options.sizeValue ?? 25}
                          onChange={(e) => setOptions((o) => ({ ...o, sizeValue: Number(e.target.value) }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-size-unit" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Unit
                        </label>
                        <select
                          id="opt-size-unit"
                          value={options.sizeUnit ?? 'MB'}
                          onChange={(e) =>
                            setOptions((o) => ({ ...o, sizeUnit: e.target.value as ProcessOptions['sizeUnit'] }))
                          }
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        >
                          <option value="B">Bytes (B)</option>
                          <option value="KB">Kilobytes (KB)</option>
                          <option value="MB">Megabytes (MB)</option>
                          <option value="GB">Gigabytes (GB)</option>
                          <option value="TB">Terabytes (TB)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'crop' && (
                    <div>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                        Center-Crop Aspect Ratio
                      </span>
                      <div className="inline-flex flex-wrap rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                        {(['1:1', '16:9', '4:3', '9:16', '3:2'] as const).map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setOptions((o) => ({ ...o, cropAspect: ratio }))}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                              options.cropAspect === ratio
                                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'watermark' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      <div>
                        <label htmlFor="opt-wm-text" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Watermark Text
                        </label>
                        <input
                          id="opt-wm-text"
                          type="text"
                          value={options.watermarkText ?? 'NexcTool'}
                          onChange={(e) => setOptions((o) => ({ ...o, watermarkText: e.target.value }))}
                          placeholder="CONFIDENTIAL"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                          <label htmlFor="opt-wm-opacity">Opacity</label>
                          <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">
                            {options.watermarkOpacity ?? 50}%
                          </span>
                        </div>
                        <input
                          id="opt-wm-opacity"
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={options.watermarkOpacity ?? 50}
                          onChange={(e) => setOptions((o) => ({ ...o, watermarkOpacity: Number(e.target.value) }))}
                          className="w-full accent-[#4F46E5]"
                        />
                      </div>
                      {tool.category === 'image-tools' && (
                        <div>
                          <label htmlFor="opt-wm-pos" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                            Placement
                          </label>
                          <select
                            id="opt-wm-pos"
                            value={options.watermarkPosition ?? 'center'}
                            onChange={(e) =>
                              setOptions((o) => ({
                                ...o,
                                watermarkPosition: e.target.value as ProcessOptions['watermarkPosition'],
                              }))
                            }
                            className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                          >
                            <option value="center">Center Diagonal</option>
                            <option value="bottom-right">Bottom Right</option>
                            <option value="tile">Tiled Pattern</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {tool.optionType === 'target-format' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div>
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                          Target Output Format
                        </span>
                        <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                          {(['webp', 'png', 'jpg'] as const).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setOptions((o) => ({ ...o, targetFormat: fmt }))}
                              className={`px-4 py-1.5 text-xs font-semibold uppercase rounded-full transition-all cursor-pointer ${
                                options.targetFormat === fmt
                                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                          <label htmlFor="opt-batch-q">Quality (JPG / WebP)</label>
                          <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">
                            {options.quality}%
                          </span>
                        </div>
                        <input
                          id="opt-batch-q"
                          type="range"
                          min={20}
                          max={95}
                          step={5}
                          value={options.quality ?? 85}
                          onChange={(e) => setOptions((o) => ({ ...o, quality: Number(e.target.value) }))}
                          className="w-full accent-[#4F46E5]"
                        />
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'page-range' && (
                    <div className="max-w-sm">
                      <label htmlFor="opt-page-range" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Page Numbers or Ranges (e.g. 1, 3-5)
                      </label>
                      <input
                        id="opt-page-range"
                        type="text"
                        value={options.pageRange ?? '1'}
                        onChange={(e) => setOptions((o) => ({ ...o, pageRange: e.target.value }))}
                        placeholder="1, 3-5"
                        className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {tool.optionType === 'pdf-meta' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="opt-pdf-title" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Title
                        </label>
                        <input
                          id="opt-pdf-title"
                          type="text"
                          value={options.pdfTitle ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, pdfTitle: e.target.value }))}
                          placeholder="Document Title"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-pdf-author" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Author
                        </label>
                        <input
                          id="opt-pdf-author"
                          type="text"
                          value={options.pdfAuthor ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, pdfAuthor: e.target.value }))}
                          placeholder="Author Name"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-pdf-subject" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Subject
                        </label>
                        <input
                          id="opt-pdf-subject"
                          type="text"
                          value={options.pdfSubject ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, pdfSubject: e.target.value }))}
                          placeholder="Subject / Topic"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'csv-split' && (
                    <div className="max-w-xs">
                      <label htmlFor="opt-csv-rows" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Data Rows per Output CSV
                      </label>
                      <input
                        id="opt-csv-rows"
                        type="number"
                        min={1}
                        max={100000}
                        value={options.csvSplitRows ?? 100}
                        onChange={(e) => setOptions((o) => ({ ...o, csvSplitRows: Number(e.target.value) }))}
                        className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {tool.optionType === 'tolerance' && (
                    <div className="max-w-sm">
                      <div className="flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                        <label htmlFor="opt-tolerance">Color Match Tolerance</label>
                        <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">
                          {options.tolerance ?? 32}
                        </span>
                      </div>
                      <input
                        id="opt-tolerance"
                        type="range"
                        min={5}
                        max={110}
                        step={1}
                        value={options.tolerance ?? 32}
                        onChange={(e) => setOptions((o) => ({ ...o, tolerance: Number(e.target.value) }))}
                        className="w-full accent-[#4F46E5]"
                      />
                    </div>
                  )}

                  {tool.optionType === 'signature' && (
                    <div className="max-w-sm">
                      <label htmlFor="opt-sig" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Signature Name
                      </label>
                      <input
                        id="opt-sig"
                        type="text"
                        value={options.signatureText ?? 'Signed Digitally'}
                        onChange={(e) => setOptions((o) => ({ ...o, signatureText: e.target.value }))}
                        placeholder="Your Name"
                        className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {tool.optionType === 'form-fields' && (
                    <div>
                      <label htmlFor="opt-form-vals" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Form Field Values (one <span className="font-mono">FieldName=Value</span> per line)
                      </label>
                      <textarea
                        id="opt-form-vals"
                        rows={3}
                        value={options.formValues ?? ''}
                        onChange={(e) => setOptions((o) => ({ ...o, formValues: e.target.value }))}
                        placeholder={'FullName=Jane Doe\nAgreed=true'}
                        className="w-full p-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {tool.optionType === 'doc-watermark' && (
                    <div className="max-w-sm">
                      <label htmlFor="opt-doc-wm" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Document Watermark Text
                      </label>
                      <input
                        id="opt-doc-wm"
                        type="text"
                        value={options.documentWatermark ?? 'CONFIDENTIAL'}
                        onChange={(e) => setOptions((o) => ({ ...o, documentWatermark: e.target.value }))}
                        placeholder="CONFIDENTIAL"
                        className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {tool.optionType === 'audio-trim' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                      <div>
                        <label htmlFor="opt-trim-start" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Start Time (seconds)
                        </label>
                        <input
                          id="opt-trim-start"
                          type="number"
                          min={0}
                          step={0.5}
                          value={options.trimStartSec ?? 0}
                          onChange={(e) => setOptions((o) => ({ ...o, trimStartSec: Number(e.target.value) }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-trim-end" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          End Time (seconds)
                        </label>
                        <input
                          id="opt-trim-end"
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={options.trimEndSec ?? 10}
                          onChange={(e) => setOptions((o) => ({ ...o, trimEndSec: Number(e.target.value) }))}
                          className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'audio-volume' && (
                    <div className="max-w-sm">
                      <div className="flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
                        <label htmlFor="opt-audio-vol">Gain / Volume</label>
                        <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">
                          {options.volumePercent ?? 150}%
                        </span>
                      </div>
                      <input
                        id="opt-audio-vol"
                        type="range"
                        min={10}
                        max={300}
                        step={10}
                        value={options.volumePercent ?? 150}
                        onChange={(e) => setOptions((o) => ({ ...o, volumePercent: Number(e.target.value) }))}
                        className="w-full accent-[#4F46E5]"
                      />
                    </div>
                  )}

                  {tool.optionType === 'audio-speed' && (
                    <div>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                        Playback Speed
                      </span>
                      <div className="inline-flex flex-wrap rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                        {[0.5, 0.75, 1.25, 1.5, 2.0].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => setOptions((o) => ({ ...o, speedFactor: spd }))}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                              options.speedFactor === spd
                                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'audio-meta' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="opt-aud-title" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Track Title
                        </label>
                        <input
                          id="opt-aud-title"
                          type="text"
                          value={options.audioTitle ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, audioTitle: e.target.value }))}
                          placeholder="Track Title"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-aud-artist" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Artist
                        </label>
                        <input
                          id="opt-aud-artist"
                          type="text"
                          value={options.audioArtist ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, audioArtist: e.target.value }))}
                          placeholder="Artist Name"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="opt-aud-album" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                          Album
                        </label>
                        <input
                          id="opt-aud-album"
                          type="text"
                          value={options.audioAlbum ?? ''}
                          onChange={(e) => setOptions((o) => ({ ...o, audioAlbum: e.target.value }))}
                          placeholder="Album Name"
                          className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {tool.optionType === 'archive-target' && (
                    <div>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                        Target Archive Format
                      </span>
                      <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
                        {(['zip', 'tar', 'gz'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setOptions((o) => ({ ...o, archiveTarget: fmt }))}
                            className={`px-4 py-1.5 text-xs font-semibold uppercase rounded-full transition-all cursor-pointer ${
                              options.archiveTarget === fmt
                                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {fmt === 'gz' ? 'TAR.GZ' : fmt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {isComingSoon ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="w-full sm:w-auto px-7 py-3.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-base font-semibold rounded-full cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleProcess}
                    disabled={!canProcess}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500 disabled:shadow-none text-white text-base font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processing locally...' : tool.actionLabel}
                  </button>
                )}

                {(files.length > 0 || textInput.trim().length > 0 || result) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold rounded-full transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span>Process Another File</span>
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              {(processing || progress > 0) && !result && !error && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Processing inside your browser...</span>
                    <span className="font-mono tabular-nums">{progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200 text-sm"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="font-semibold">Unable to complete processing</div>
                    <p className="mt-0.5 text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Success State */}
              {result && (
                <div
                  data-testid="tool-success-panel"
                  className="p-5 sm:p-6 rounded-[20px] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#16A34A] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Ready — Processed Locally in Your Browser
                      </h2>
                      {result.summaryLines && result.summaryLines.length > 0 && (
                        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5 font-mono tabular-nums">
                          {result.summaryLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {result.previewDataUrl && (
                    beforePreviewUrl ? (
                      <div
                        data-testid="before-after-comparison"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                            <span>Before (Original)</span>
                            {files[0] && (
                              <span className="font-mono tabular-nums">{formatBytes(files[0].size)}</span>
                            )}
                          </div>
                          <img
                            src={beforePreviewUrl}
                            alt={`Original input for ${tool.name}`}
                            className="max-h-52 w-auto mx-auto rounded object-contain"
                          />
                        </div>

                        <div className="border border-emerald-200 dark:border-emerald-800/70 rounded-xl bg-white dark:bg-slate-900 p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                            <span>After (Processed)</span>
                            <span className="font-mono tabular-nums">
                              {result.files?.[0] ? formatBytes(result.files[0].size) : ''}
                              {savingsPct !== null && savingsPct > 0 ? ` · -${savingsPct}%` : ''}
                            </span>
                          </div>
                          <img
                            src={result.previewDataUrl}
                            alt={`${tool.name} output preview`}
                            className="max-h-52 w-auto mx-auto rounded object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-3 max-w-sm">
                        <img
                          src={result.previewDataUrl}
                          alt={`${tool.name} output preview`}
                          className="max-h-56 w-auto mx-auto rounded object-contain"
                        />
                      </div>
                    )
                  )}

                  {result.textOutput !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Output Preview</span>
                        <button
                          type="button"
                          onClick={handleCopyOutput}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copied ? 'Copied' : 'Copy Output'}</span>
                        </button>
                      </div>
                      <pre className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 overflow-x-auto max-h-72">
                        {result.textOutput}
                      </pre>
                    </div>
                  )}

                  {downloadUrls.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {downloadUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={handleDownloadAllZip}
                          disabled={zipping}
                          data-testid="download-all-zip"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-60"
                        >
                          <Archive className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {zipping
                              ? 'Building ZIP...'
                              : `Download All as ZIP (${downloadUrls.length} files)`}
                          </span>
                        </button>
                      )}
                      {downloadUrls.map((dl, idx) => (
                        <a
                          key={idx}
                          href={dl.url}
                          download={dl.filename}
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-sm hover:scale-[1.02] transition-all"
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                          <span>
                            Download {dl.filename} ({formatBytes(dl.size)})
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* How to use - 3 simple steps */}
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-5">
            How to use {tool.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {seo.steps.map((step, idx) => (
              <div
                key={step.title}
                className="p-5 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-xs"
              >
                <div className="text-sm font-bold text-[#4F46E5] dark:text-indigo-400 font-mono tabular-nums">
                  0{idx + 1}.
                </div>
                <h3 className="mt-2 text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features - 4 bullet points */}
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-5">
            Features of {tool.name}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {seo.features.map((feat) => (
              <li
                key={feat.title}
                className="p-5 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] flex items-start gap-3 shadow-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-[#4F46E5] dark:text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{feat.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feat.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ - 4 questions and answers */}
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-5">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-[20px] bg-white dark:bg-[#111827] overflow-hidden">
            {seo.faqs.map((faq) => (
              <div key={faq.question} className="p-5 sm:p-6">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{faq.question}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Tools */}
        {relatedTools.length > 0 && (
          <section className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                More {tool.categoryName}
              </h2>
              <Link
                to={`/category/${tool.category}`}
                className="text-sm font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {relatedTools.map((rel) => (
                <Link
                  key={rel.slug}
                  to={`/tools/${rel.slug}`}
                  className="p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] hover:-translate-y-0.5 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:shadow-md transition-all"
                >
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">{rel.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {rel.mode === 'coming-soon' ? 'Coming Soon' : 'Runs in browser'}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
    </>
  );
}
