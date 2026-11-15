import { useEffect, useState } from 'react';
import { Check, Copy, Download, ImagePlus, ScanText } from 'lucide-react';

const OCR_LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'sin', label: 'Sinhala' },
  { code: 'eng+sin', label: 'English + Sinhala' },
  { code: 'tam', label: 'Tamil' },
  { code: 'hin', label: 'Hindi' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'ara', label: 'Arabic' },
] as const;

export function ImageOcrTool() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('eng');
  const [running, setRunning] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Support pasting screenshots directly from clipboard (Ctrl+V / Cmd+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const pasted = item.getAsFile();
          if (pasted) {
            handleFileSelect(pasted);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setConfidence(null);
    setImageFile(file);
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  };

  const handleExtractText = async () => {
    if (!imageFile) return;
    setRunning(true);
    setError(null);
    setProgress(5);
    setStatusLabel('Loading OCR engine...');

    let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | null = null;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker(language, 1, {
        logger: (m) => {
          if (m.status) {
            setStatusLabel(m.status.charAt(0).toUpperCase() + m.status.slice(1));
          }
          if (typeof m.progress === 'number') {
            setProgress(Math.max(5, Math.min(100, Math.round(m.progress * 100))));
          }
        },
      });
      const result = await worker.recognize(imageFile);
      setExtractedText(result.data.text.trim());
      setConfidence(Math.round(result.data.confidence));
      setProgress(100);
      setStatusLabel('Done');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to extract text from this image. Check network connectivity if downloading a new language pack.'
      );
      setProgress(0);
    } finally {
      if (worker) {
        await worker.terminate().catch(() => {});
      }
      setRunning(false);
    }
  };

  const handleCopy = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadTxt = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const wordCount = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-5">
      {/* Upload / Paste Dropzone */}
      <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer">
        <ImagePlus className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {imageFile ? `Loaded: ${imageFile.name} (Click to replace)` : 'Upload Image or Paste Screenshot (Ctrl+V)'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Supports JPG, PNG, WebP, BMP, and clipboard screenshots — OCR runs locally via WebAssembly
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
      </label>

      {/* Controls */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[210px] flex-1 max-w-xs">
          <label htmlFor="ocr-lang" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Recognition Language
          </label>
          <select
            id="ocr-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={running}
            className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          >
            {OCR_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!imageFile || running}
          onClick={handleExtractText}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-400 text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <ScanText className="w-4 h-4" aria-hidden="true" />
          <span>{running ? 'Recognizing Text...' : 'Extract Text (OCR)'}</span>
        </button>
      </div>

      {/* Progress */}
      {running && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>{statusLabel}</span>
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

      {/* Split Preview + Editable Extracted Text */}
      {(previewUrl || extractedText) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {previewUrl && (
            <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Source Image</div>
              <img
                src={previewUrl}
                alt="Uploaded OCR source"
                className="max-h-80 w-auto mx-auto rounded-lg object-contain"
              />
            </div>
          )}

          <div className={previewUrl ? 'lg:col-span-7 space-y-2.5' : 'lg:col-span-12 space-y-2.5'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                Extracted Text · {wordCount} words · {extractedText.length} chars
                {confidence !== null ? ` · ${confidence}% confidence` : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!extractedText}
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  disabled={!extractedText}
                  onClick={handleDownloadTxt}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-full text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download .txt</span>
                </button>
              </div>
            </div>

            <textarea
              rows={11}
              aria-label="Extracted OCR text"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Click Extract Text (OCR) to recognize text from your image..."
              className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#4F46E5]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
