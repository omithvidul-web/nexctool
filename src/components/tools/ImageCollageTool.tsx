import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, ImagePlus, Trash2 } from 'lucide-react';
import { computeCollageLayout, type CollageLayoutMode } from '../../utils/collageLayout';

interface LoadedPhoto {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
  width: number;
  height: number;
}

export function ImageCollageTool() {
  const [photos, setPhotos] = useState<LoadedPhoto[]>([]);
  const [layout, setLayout] = useState<CollageLayoutMode>('horizontal');
  const [gap, setGap] = useState(16);
  const [padding, setPadding] = useState(20);
  const [radius, setRadius] = useState(12);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [outputWidth, setOutputWidth] = useState(1600);
  const [showBeforeAfterLabels, setShowBeforeAfterLabels] = useState(true);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photosRef = useRef<LoadedPhoto[]>([]);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList);
    const loaded: LoadedPhoto[] = [];

    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error(`Unable to decode "${file.name}".`));
          el.src = url;
        });
        loaded.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          url,
          img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        setError(err instanceof Error ? err.message : 'Unable to load image.');
      }
    }

    if (loaded.length > 0) {
      setPhotos((prev) => [...prev, ...loaded].slice(0, 9));
    }
  };

  const renderCollage = (canvas: HTMLCanvasElement, targetW: number) => {
    const activePhotos = layout === 'before-after' ? photos.slice(0, 2) : photos;
    const plan = computeCollageLayout(
      activePhotos.map((p) => ({ width: p.width, height: p.height })),
      layout,
      targetW,
      gap,
      padding
    );

    canvas.width = plan.canvasWidth;
    canvas.height = plan.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, plan.canvasWidth, plan.canvasHeight);

    plan.tiles.forEach((tile, idx) => {
      const photo = activePhotos[idx];
      if (!photo) return;

      ctx.save();
      if (radius > 0) {
        ctx.beginPath();
        ctx.roundRect(tile.x, tile.y, tile.width, tile.height, radius);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(tile.x, tile.y, tile.width, tile.height);
        ctx.clip();
      }

      if (fitMode === 'cover') {
        const scale = Math.max(tile.width / photo.width, tile.height / photo.height);
        const dw = photo.width * scale;
        const dh = photo.height * scale;
        const dx = tile.x + (tile.width - dw) / 2;
        const dy = tile.y + (tile.height - dh) / 2;
        ctx.drawImage(photo.img, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
        const scale = Math.min(tile.width / photo.width, tile.height / photo.height);
        const dw = photo.width * scale;
        const dh = photo.height * scale;
        const dx = tile.x + (tile.width - dw) / 2;
        const dy = tile.y + (tile.height - dh) / 2;
        ctx.drawImage(photo.img, dx, dy, dw, dh);
      }

      if (layout === 'before-after' && showBeforeAfterLabels) {
        const labelText = idx === 0 ? 'BEFORE' : 'AFTER';
        const fontSize = Math.max(14, Math.round(tile.width * 0.04));
        ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
        const metrics = ctx.measureText(labelText);
        const padX = Math.round(fontSize * 0.7);
        const padY = Math.round(fontSize * 0.4);
        const pillW = metrics.width + padX * 2;
        const pillH = fontSize + padY * 2;
        const lx = tile.x + 14;
        const ly = tile.y + tile.height - pillH - 14;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.beginPath();
        ctx.roundRect(lx, ly, pillW, pillH, 8);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, lx + padX, ly + pillH / 2 + 1);
      }

      ctx.restore();
    });
  };

  useEffect(() => {
    if (!canvasRef.current || photos.length === 0) return;
    renderCollage(canvasRef.current, outputWidth);
  });

  const movePhoto = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    setPhotos((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleDownload = () => {
    if (photos.length === 0) return;
    const out = document.createElement('canvas');
    renderCollage(out, outputWidth);
    const mime =
      exportFormat === 'jpg'
        ? 'image/jpeg'
        : exportFormat === 'webp'
          ? 'image/webp'
          : 'image/png';
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexctool-collage.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      },
      mime,
      exportFormat === 'png' ? undefined : 0.92
    );
  };

  return (
    <div className="space-y-5">
      {/* Upload */}
      <label className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer">
        <ImagePlus className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {photos.length > 0 ? `Add More Photos (${photos.length}/9 loaded)` : 'Select 2–9 Photos for Collage / Side-by-Side'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Supports JPG, PNG, WebP, GIF, SVG — arranged 100% locally in browser
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Photo Reorder Strip */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            >
              <img src={p.url} alt={p.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move left"
                  disabled={idx === 0}
                  onClick={() => movePhoto(idx, -1)}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move right"
                  disabled={idx === photos.length - 1}
                  onClick={() => movePhoto(idx, 1)}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => removePhoto(p.id)}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Layout & Styling Controls */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mr-1">Layout:</span>
          {(
            [
              { id: 'horizontal', label: 'Side-by-Side' },
              { id: 'vertical', label: 'Vertical Stack' },
              { id: 'grid-2x2', label: '2×2 Grid' },
              { id: 'grid-3x3', label: '3×3 Grid' },
              { id: 'before-after', label: 'Before / After' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLayout(item.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                layout === item.id
                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <label htmlFor="col-gap">Gap</label>
              <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{gap}px</span>
            </div>
            <input
              id="col-gap"
              type="range"
              min={0}
              max={48}
              step={4}
              value={gap}
              onChange={(e) => setGap(Number(e.target.value))}
              className="w-full accent-[#4F46E5]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <label htmlFor="col-pad">Padding</label>
              <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{padding}px</span>
            </div>
            <input
              id="col-pad"
              type="range"
              min={0}
              max={48}
              step={4}
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              className="w-full accent-[#4F46E5]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <label htmlFor="col-rad">Corners</label>
              <span className="font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">{radius}px</span>
            </div>
            <input
              id="col-rad"
              type="range"
              min={0}
              max={36}
              step={2}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-[#4F46E5]"
            />
          </div>

          <div>
            <label htmlFor="col-fit" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Image Fit
            </label>
            <select
              id="col-fit"
              value={fitMode}
              onChange={(e) => setFitMode(e.target.value as 'cover' | 'contain')}
              className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="cover">Cover (Fill Tile)</option>
              <option value="contain">Contain (No Crop)</option>
            </select>
          </div>

          <div>
            <label htmlFor="col-bg" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Frame Color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="col-bg"
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-9 h-9 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{bgColor}</span>
            </div>
          </div>
        </div>

        {layout === 'before-after' && (
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showBeforeAfterLabels}
              onChange={(e) => setShowBeforeAfterLabels(e.target.checked)}
              className="accent-[#4F46E5]"
            />
            <span>Show BEFORE / AFTER labels</span>
          </label>
        )}
      </div>

      {/* Preview & Export */}
      {photos.length > 0 ? (
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100 dark:bg-slate-950 p-3 flex justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              aria-label="Collage output preview"
              className="max-h-[480px] max-w-full w-auto h-auto rounded-lg shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label htmlFor="col-width" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Width:
                </label>
                <select
                  id="col-width"
                  value={outputWidth}
                  onChange={(e) => setOutputWidth(Number(e.target.value))}
                  className="h-8 px-2.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value={1200}>1200px</option>
                  <option value={1600}>1600px</option>
                  <option value={2400}>2400px</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                {(['png', 'jpg', 'webp'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`px-3 py-1 text-xs font-semibold uppercase rounded-full cursor-pointer ${
                      exportFormat === fmt
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download Collage ({exportFormat.toUpperCase()})</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-sm text-slate-500 dark:text-slate-400">
          Upload 2 or more images above to preview and download a side-by-side or grid collage.
        </div>
      )}
    </div>
  );
}
