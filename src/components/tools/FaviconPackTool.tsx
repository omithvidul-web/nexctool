import { useEffect, useState } from 'react';
import { Archive, Check, Copy, Download, ImagePlus, Sparkles } from 'lucide-react';
import { createZipBlob } from '../../utils/zipHelper';
import {
  buildIcoFromPngFrames,
  buildWebManifestJson,
  FAVICON_HTML_SNIPPET,
} from '../../utils/icoBuilder';

const ICON_SIZES = [16, 32, 48, 180, 192, 512] as const;

function renderIconCanvas(
  img: HTMLImageElement,
  size: number,
  options: {
    transparentBg: boolean;
    bgColor: string;
    paddingPct: number;
    radiusPct: number;
  }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const r = Math.round((size * options.radiusPct) / 100);
  if (r > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.clip();
  }

  if (!options.transparentBg) {
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const pad = Math.round((size * options.paddingPct) / 100);
  const avail = Math.max(1, size - pad * 2);
  const scale = Math.min(avail / (img.naturalWidth || 1), avail / (img.naturalHeight || 1));
  const dw = (img.naturalWidth || 1) * scale;
  const dh = (img.naturalHeight || 1) * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
  return canvas;
}

function canvasToPngUint8(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to export PNG frame.'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

export function FaviconPackTool() {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [appName, setAppName] = useState('NexcTool App');
  const [transparentBg, setTransparentBg] = useState(true);
  const [bgColor, setBgColor] = useState('#4F46E5');
  const [paddingPct, setPaddingPct] = useState(8);
  const [radiusPct, setRadiusPct] = useState(18);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (!sourceImg) {
      setPreviews({});
      return;
    }
    const next: Record<number, string> = {};
    for (const sz of ICON_SIZES) {
      const c = renderIconCanvas(sourceImg, sz, {
        transparentBg,
        bgColor,
        paddingPct,
        radiusPct,
      });
      next[sz] = c.toDataURL('image/png');
    }
    setPreviews(next);
  }, [sourceImg, transparentBg, bgColor, paddingPct, radiusPct]);

  const loadImageUrl = (url: string, revokeOld = true) => {
    setError(null);
    const img = new Image();
    img.onload = () => {
      setSourceImg(img);
      if (revokeOld) {
        setSourceUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    };
    img.onerror = () => {
      if (revokeOld) URL.revokeObjectURL(url);
      setError('Unable to decode this image. Please upload a PNG, SVG, JPG, or WebP logo.');
    };
    img.src = url;
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    loadImageUrl(url, true);
  };

  const handleLoadSample = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4F46E5"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient></defs><rect width="256" height="256" rx="56" fill="url(#g)"/><path d="M72 180V76h24l64 68V76h24v104h-24l-64-68v68H72z" fill="#fff"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    loadImageUrl(url, true);
  };

  const handleDownloadIcoOnly = async () => {
    if (!sourceImg) return;
    setBusy(true);
    setError(null);
    try {
      const icoSizes = [16, 32, 48] as const;
      const frames = await Promise.all(
        icoSizes.map(async (sz) => ({
          width: sz,
          height: sz,
          pngBytes: await canvasToPngUint8(
            renderIconCanvas(sourceImg, sz, { transparentBg, bgColor, paddingPct, radiusPct })
          ),
        }))
      );
      const icoBytes = buildIcoFromPngFrames(frames);
      const cleanCopy = new Uint8Array(icoBytes.byteLength);
      cleanCopy.set(icoBytes);
      const blob = new Blob([cleanCopy.buffer], { type: 'image/x-icon' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'favicon.ico';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate favicon.ico.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadZipPack = async () => {
    if (!sourceImg) return;
    setBusy(true);
    setError(null);
    try {
      const nameMap: Record<number, string> = {
        16: 'favicon-16x16.png',
        32: 'favicon-32x32.png',
        48: 'favicon-48x48.png',
        180: 'apple-touch-icon.png',
        192: 'android-chrome-192x192.png',
        512: 'android-chrome-512x512.png',
      };

      const pngEntries: { size: number; filename: string; bytes: Uint8Array }[] = [];
      for (const sz of ICON_SIZES) {
        const canvas = renderIconCanvas(sourceImg, sz, { transparentBg, bgColor, paddingPct, radiusPct });
        const bytes = await canvasToPngUint8(canvas);
        pngEntries.push({ size: sz, filename: nameMap[sz], bytes });
      }

      const icoBytes = buildIcoFromPngFrames(
        pngEntries
          .filter((e) => e.size === 16 || e.size === 32 || e.size === 48)
          .map((e) => ({ width: e.size, height: e.size, pngBytes: e.bytes }))
      );

      const enc = new TextEncoder();
      const manifestJson = buildWebManifestJson(appName, transparentBg ? '#4F46E5' : bgColor, bgColor);

      const zipBlob = await createZipBlob([
        { filename: 'favicon.ico', data: icoBytes },
        ...pngEntries.map((e) => ({ filename: e.filename, data: e.bytes })),
        { filename: 'site.webmanifest', data: enc.encode(manifestJson) },
        { filename: 'favicon-head-tags.html', data: enc.encode(FAVICON_HTML_SNIPPET) },
      ]);

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nexctool-favicon-pack.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to package favicon ZIP.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(FAVICON_HTML_SNIPPET);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <label className="flex-1 flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer">
          <ImagePlus className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {sourceImg ? 'Replace Logo Image' : 'Upload Square Logo (PNG, SVG, JPG, WebP)'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Recommended: 512×512px or SVG vector logo
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        </label>

        <button
          type="button"
          onClick={handleLoadSample}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#4F46E5] rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
          <span>Try Sample Icon</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Options */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="fav-app-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            App / Website Name
          </label>
          <input
            id="fav-app-name"
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Background Fill
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTransparentBg((v) => !v)}
              className={`px-3 h-9 text-xs font-semibold rounded-xl border cursor-pointer whitespace-nowrap ${
                transparentBg
                  ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              {transparentBg ? 'Transparent' : 'Solid Color'}
            </button>
            {!transparentBg && (
              <input
                type="color"
                aria-label="Icon background color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-9 h-9 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <label htmlFor="fav-pad">Inner Padding</label>
            <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{paddingPct}%</span>
          </div>
          <input
            id="fav-pad"
            type="range"
            min={0}
            max={24}
            step={2}
            value={paddingPct}
            onChange={(e) => setPaddingPct(Number(e.target.value))}
            className="w-full accent-[#4F46E5]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <label htmlFor="fav-rad">Corner Radius</label>
            <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{radiusPct}%</span>
          </div>
          <input
            id="fav-rad"
            type="range"
            min={0}
            max={50}
            step={2}
            value={radiusPct}
            onChange={(e) => setRadiusPct(Number(e.target.value))}
            className="w-full accent-[#4F46E5]"
          />
        </div>
      </div>

      {/* Live Preview & Downloads */}
      {sourceImg ? (
        <div className="space-y-5">
          {/* Browser Tab & Home Screen Mockup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                Browser Tab Preview (16×16)
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-xl max-w-xs shadow-xs">
                {previews[16] && (
                  <img src={previews[16]} alt="16x16 browser favicon" className="w-4 h-4 shrink-0" />
                )}
                <span className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                  {appName || 'My Website'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                All Generated Sizes
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {ICON_SIZES.map((sz) => (
                  <div key={sz} className="flex flex-col items-center gap-1">
                    {previews[sz] && (
                      <img
                        src={previews[sz]}
                        alt={`${sz}x${sz} icon`}
                        style={{ width: Math.min(48, Math.max(16, sz)), height: Math.min(48, Math.max(16, sz)) }}
                        className="border border-slate-200 dark:border-slate-700 rounded"
                      />
                    )}
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {sz}px
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleDownloadZipPack}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-60"
            >
              <Archive className="w-4 h-4" aria-hidden="true" />
              <span>{busy ? 'Generating Pack...' : 'Download Full ZIP Pack (.ico + PNGs + Manifest)'}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleDownloadIcoOnly}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-xs cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download favicon.ico</span>
            </button>
          </div>

          {/* HTML Snippet */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                HTML &lt;head&gt; Tags
              </span>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {copiedHtml ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHtml ? 'Copied' : 'Copy HTML'}</span>
              </button>
            </div>
            <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
              {FAVICON_HTML_SNIPPET}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-sm text-slate-500 dark:text-slate-400">
          Upload your logo image (or click <strong>Try Sample Icon</strong>) to preview and export your favicon pack.
        </div>
      )}
    </div>
  );
}
