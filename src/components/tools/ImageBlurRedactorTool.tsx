import { useEffect, useRef, useState } from 'react';
import { Download, Eraser, ImagePlus, Trash2, Undo2 } from 'lucide-react';

type RedactMode = 'blur' | 'pixelate' | 'blackout' | 'whiteout';

interface RedactBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mode: RedactMode;
  strength: number;
}

function drawRedactedImageToCanvas(
  targetCanvas: HTMLCanvasElement,
  img: HTMLImageElement,
  boxes: RedactBox[],
  draftBox: RedactBox | null
) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  targetCanvas.width = w;
  targetCanvas.height = h;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const allBoxes = draftBox ? [...boxes, draftBox] : boxes;
  for (const box of allBoxes) {
    const rx = Math.max(0, Math.round(Math.min(box.x, box.x + box.w)));
    const ry = Math.max(0, Math.round(Math.min(box.y, box.y + box.h)));
    const rw = Math.min(w - rx, Math.round(Math.abs(box.w)));
    const rh = Math.min(h - ry, Math.round(Math.abs(box.h)));
    if (rw < 2 || rh < 2) continue;

    if (box.mode === 'blackout') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(rx, ry, rw, rh);
    } else if (box.mode === 'whiteout') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(rx, ry, rw, rh);
    } else if (box.mode === 'blur') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      const radius = Math.max(4, Math.round((box.strength * Math.max(w, h)) / 700));
      ctx.filter = `blur(${radius}px)`;
      // Draw slightly expanded region so edge pixels stay crisp
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else if (box.mode === 'pixelate') {
      const blockSize = Math.max(4, Math.round((box.strength * Math.max(w, h)) / 500));
      const cols = Math.max(1, Math.ceil(rw / blockSize));
      const rows = Math.max(1, Math.ceil(rh / blockSize));
      const mini = document.createElement('canvas');
      mini.width = cols;
      mini.height = rows;
      const mctx = mini.getContext('2d');
      if (mctx) {
        mctx.drawImage(img, rx, ry, rw, rh, 0, 0, cols, rows);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(mini, 0, 0, cols, rows, rx, ry, rw, rh);
        ctx.restore();
      }
    }
  }

  // Highlight draft box outline while dragging
  if (draftBox) {
    const rx = Math.min(draftBox.x, draftBox.x + draftBox.w);
    const ry = Math.min(draftBox.y, draftBox.y + draftBox.h);
    const rw = Math.abs(draftBox.w);
    const rh = Math.abs(draftBox.h);
    ctx.save();
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = Math.max(2, Math.round(Math.max(w, h) / 400));
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }
}

export function ImageBlurRedactorTool() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgName, setImgName] = useState('image.png');
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<RedactMode>('blur');
  const [strength, setStrength] = useState(18);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [draftBox, setDraftBox] = useState<RedactBox | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    drawRedactedImageToCanvas(canvasRef.current, imgEl, boxes, draftBox);
  }, [imgEl, boxes, draftBox]);

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setImgName(file.name);
      setBoxes([]);
      setDraftBox(null);
      setImgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Unable to load this image. Please try a valid JPG, PNG, WebP, or SVG file.');
    };
    img.src = url;
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imgEl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    dragStartRef.current = pt;
    setDraftBox({
      id: 'draft',
      x: pt.x,
      y: pt.y,
      w: 0,
      h: 0,
      mode,
      strength,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return;
    const pt = getCanvasPoint(e);
    setDraftBox({
      id: 'draft',
      x: dragStartRef.current.x,
      y: dragStartRef.current.y,
      w: pt.x - dragStartRef.current.x,
      h: pt.y - dragStartRef.current.y,
      mode,
      strength,
    });
  };

  const commitDraft = () => {
    if (!dragStartRef.current || !draftBox) {
      dragStartRef.current = null;
      setDraftBox(null);
      return;
    }
    if (Math.abs(draftBox.w) >= 8 && Math.abs(draftBox.h) >= 8) {
      setBoxes((prev) => [
        ...prev,
        {
          ...draftBox,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      ]);
    }
    dragStartRef.current = null;
    setDraftBox(null);
  };

  const handleExport = () => {
    if (!imgEl) return;
    const outCanvas = document.createElement('canvas');
    drawRedactedImageToCanvas(outCanvas, imgEl, boxes, null);
    const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    outCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dot = imgName.lastIndexOf('.');
        const base = dot > 0 ? imgName.slice(0, dot) : imgName;
        a.href = url;
        a.download = `${base}-redacted.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      },
      mime,
      exportFormat === 'jpg' ? 0.92 : undefined
    );
  };

  return (
    <div className="space-y-5">
      {/* Upload or Replace */}
      <label className="flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#4F46E5] transition-colors cursor-pointer">
        <ImagePlus className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {imgEl ? `Loaded: ${imgName} (Click to change image)` : 'Upload Photo or Screenshot to Blur / Redact'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Drag directly on the image below to hide faces, IDs, or phone numbers
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </label>

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mr-1">Brush Mode:</span>
          {(
            [
              { id: 'blur', label: 'Blur' },
              { id: 'pixelate', label: 'Pixelate' },
              { id: 'blackout', label: 'Black Box' },
              { id: 'whiteout', label: 'White Box' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                mode === m.id
                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {(mode === 'blur' || mode === 'pixelate') && (
          <div className="flex items-center gap-2.5 min-w-[180px]">
            <label htmlFor="redact-strength" className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Intensity
            </label>
            <input
              id="redact-strength"
              type="range"
              min={6}
              max={40}
              step={2}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="w-28 accent-[#4F46E5]"
            />
            <span className="text-xs font-mono tabular-nums text-[#4F46E5] dark:text-indigo-400">
              {strength}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={boxes.length === 0}
            onClick={() => setBoxes((prev) => prev.slice(0, -1))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            disabled={boxes.length === 0}
            onClick={() => setBoxes([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear ({boxes.length})</span>
          </button>
        </div>
      </div>

      {/* Interactive Canvas */}
      {imgEl ? (
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100 dark:bg-slate-950 p-3 flex justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={commitDraft}
              onPointerCancel={commitDraft}
              className="max-h-[520px] max-w-full w-auto h-auto rounded-lg cursor-crosshair touch-none shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Output Format:</span>
              {(['png', 'jpg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setExportFormat(fmt)}
                  className={`px-3.5 py-1.5 text-xs font-semibold uppercase rounded-full cursor-pointer ${
                    exportFormat === fmt
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download Redacted {exportFormat.toUpperCase()}</span>
            </button>
          </div>

          {boxes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {boxes.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoxes((prev) => prev.filter((item) => item.id !== b.id))}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
                >
                  <span>Region #{i + 1} ({b.mode})</span>
                  <Trash2 className="w-3 h-3 text-red-500" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-sm text-slate-500 dark:text-slate-400">
          Select a photo or screenshot above, then click and drag over any sensitive area to blur or redact it privately.
        </div>
      )}
    </div>
  );
}
