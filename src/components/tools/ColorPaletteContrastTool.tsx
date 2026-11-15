import { useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, CheckCircle2, Copy, FileUp, Palette, Sparkles, XCircle } from 'lucide-react';
import {
  computeWcagContrast,
  extractPaletteFromRgba,
  normalizeHex,
  type SwatchItem,
} from '../../utils/colorContrastHelper';

export function ColorPaletteContrastTool() {
  const [swatches, setSwatches] = useState<SwatchItem[]>([
    { hex: '#4F46E5', rgb: { r: 79, g: 70, b: 229 }, hslString: 'hsl(243, 75%, 59%)', percent: 34 },
    { hex: '#0F172A', rgb: { r: 15, g: 23, b: 42 }, hslString: 'hsl(222, 47%, 11%)', percent: 28 },
    { hex: '#10B981', rgb: { r: 16, g: 185, b: 129 }, hslString: 'hsl(160, 84%, 39%)', percent: 20 },
    { hex: '#F8FAFC', rgb: { r: 248, g: 250, b: 252 }, hslString: 'hsl(210, 40%, 98%)', percent: 18 },
  ]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const [fgHex, setFgHex] = useState('#0F172A');
  const [bgHex, setBgHex] = useState('#F8FAFC');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wcagReport = useMemo(() => computeWcagContrast(fgHex, bgHex), [fgHex, bgHex]);

  const processCanvasForPalette = (drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFn(ctx, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const extracted = extractPaletteFromRgba(imgData.data, 6);
    if (extracted.length > 0) {
      setSwatches(extracted);
    }
  };

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      processCanvasForPalette((ctx, w, h) => {
        ctx.drawImage(img, 0, 0, w, h);
      });
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    };
    img.src = url;
  };

  const handleLoadSampleGradient = () => {
    processCanvasForPalette((ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#312E81');
      grad.addColorStop(0.35, '#7C3AED');
      grad.addColorStop(0.7, '#EC4899');
      grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const canvasEl = ctx.canvas;
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return canvasEl.toDataURL('image/png');
      });
    });
  };

  const handleCopyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    } catch {
      // ignore
    }
  };

  const fgPickerVal = normalizeHex(fgHex) ?? '#0F172A';
  const bgPickerVal = normalizeHex(bgHex) ?? '#F8FAFC';

  return (
    <div className="space-y-6">
      {/* Section 1: Image Color Palette Extractor */}
      <section className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Color Palette Extractor
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleGradient}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" aria-hidden="true" />
              <span>Extract Sample Gradient</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-xs font-semibold cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Upload Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {previewUrl && (
            <div className="md:col-span-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <img src={previewUrl} alt="Uploaded palette source" className="w-full h-40 object-cover" />
            </div>
          )}

          <div
            className={`${
              previewUrl ? 'md:col-span-8' : 'md:col-span-12'
            } grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}
          >
            {swatches.map((swatch) => (
              <div
                key={swatch.hex}
                className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                        {swatch.hex}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyHex(swatch.hex)}
                        className="p-1 text-slate-500 hover:text-[#4F46E5] cursor-pointer"
                        aria-label={`Copy ${swatch.hex}`}
                      >
                        {copiedHex === swatch.hex ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      rgb({swatch.rgb.r}, {swatch.rgb.g}, {swatch.rgb.b}) · {swatch.percent}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFgHex(swatch.hex)}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#4F46E5] cursor-pointer"
                  >
                    Use Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgHex(swatch.hex)}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#4F46E5] cursor-pointer"
                  >
                    Use BG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: WCAG Accessibility Contrast Checker */}
      <section className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            WCAG 2.1 Contrast Checker
          </h2>
          <button
            type="button"
            onClick={() => {
              const prevFg = fgHex;
              setFgHex(bgHex);
              setBgHex(prevFg);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Swap Colors</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          <div className="md:col-span-5 space-y-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <label htmlFor="fg-hex-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Foreground (Text)
                </label>
                <input
                  id="fg-hex-input"
                  type="text"
                  value={fgHex}
                  onChange={(e) => setFgHex(e.target.value)}
                  className="w-28 h-8 px-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <input
                aria-label="Foreground color picker"
                type="color"
                value={fgPickerVal}
                onChange={(e) => setFgHex(e.target.value.toUpperCase())}
                className="w-12 h-10 rounded-lg cursor-pointer bg-transparent"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <label htmlFor="bg-hex-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Background
                </label>
                <input
                  id="bg-hex-input"
                  type="text"
                  value={bgHex}
                  onChange={(e) => setBgHex(e.target.value)}
                  className="w-28 h-8 px-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <input
                aria-label="Background color picker"
                type="color"
                value={bgPickerVal}
                onChange={(e) => setBgHex(e.target.value.toUpperCase())}
                className="w-12 h-10 rounded-lg cursor-pointer bg-transparent"
              />
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-between gap-3">
            <div
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center min-h-[120px]"
              style={{ backgroundColor: bgPickerVal, color: fgPickerVal }}
            >
              <p className="text-lg font-bold">Accessible Typography Preview</p>
              <p className="text-xs mt-1 opacity-95">
                Normal body copy (14px) should reach 4.5:1 for WCAG AA and 7.0:1 for WCAG AAA.
              </p>
            </div>

            {wcagReport ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Ratio</p>
                  <p data-testid="wcag-ratio" className="text-sm font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {wcagReport.ratioFormatted}
                  </p>
                </div>
                {[
                  { label: 'AA Normal', ok: wcagReport.aaNormal },
                  { label: 'AA Large', ok: wcagReport.aaLarge },
                  { label: 'AAA Normal', ok: wcagReport.aaaNormal },
                  { label: 'AAA Large', ok: wcagReport.aaaLarge },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`p-2.5 rounded-xl border text-center ${
                      item.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase">{item.label}</p>
                    <p className="text-xs font-bold inline-flex items-center gap-1 mt-0.5">
                      {item.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{item.ok ? 'Pass' : 'Fail'}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Enter valid 3- or 6-digit HEX colors (e.g. #4F46E5).
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
