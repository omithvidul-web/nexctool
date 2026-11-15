import { useMemo, useRef, useState } from 'react';
import { BarChart3, Download, FileUp } from 'lucide-react';
import {
  buildChartSvg,
  parseChartInput,
  SAMPLE_CHART_CSV,
  type ChartKind,
} from '../../utils/chartDataHelper';

export function DataChartTool() {
  const [rawData, setRawData] = useState(SAMPLE_CHART_CSV);
  const [chartKind, setChartKind] = useState<ChartKind>('bar');
  const [chartTitle, setChartTitle] = useState('Monthly Revenue vs Expenses');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    try {
      const dataset = parseChartInput(rawData);
      const svg = buildChartSvg(dataset, chartKind, chartTitle);
      return { dataset, svg, error: null };
    } catch (err) {
      return {
        dataset: null,
        svg: '',
        error: err instanceof Error ? err.message : 'Unable to parse chart input.',
      };
    }
  }, [rawData, chartKind, chartTitle]);

  const handleUploadFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setRawData(text);
  };

  const handleDownloadSvg = () => {
    if (!parsed.svg) return;
    const blob = new Blob([parsed.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexctool-${chartKind}-chart.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleDownloadPng = () => {
    if (!parsed.svg) return;
    const svgBlob = new Blob([parsed.svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = 880 * scale;
      canvas.height = 480 * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, 880, 480);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `nexctool-${chartKind}-chart.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1500);
        }, 'image/png');
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Chart Type
            </span>
            <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
              {(['bar', 'line', 'pie'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setChartKind(kind)}
                  className={`px-4 py-1 text-xs font-semibold capitalize rounded-full cursor-pointer ${
                    chartKind === kind
                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="chart-title-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Chart Title
            </label>
            <input
              id="chart-title-input"
              type="text"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              placeholder="Optional chart heading..."
              className="w-60 h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5 text-[#4F46E5]" aria-hidden="true" />
            <span>Upload CSV / JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={(e) => handleUploadFile(e.target.files?.[0])}
          />

          <button
            type="button"
            disabled={!parsed.svg}
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download SVG</span>
          </button>

          <button
            type="button"
            disabled={!parsed.svg}
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>

      {/* Input + Live Chart Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label htmlFor="chart-raw-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              CSV or JSON Array Data
            </label>
            <button
              type="button"
              onClick={() =>
                setRawData(
                  JSON.stringify(
                    [
                      { Quarter: 'Q1', Users: 1200, Paid: 310 },
                      { Quarter: 'Q2', Users: 1950, Paid: 490 },
                      { Quarter: 'Q3', Users: 2680, Paid: 720 },
                      { Quarter: 'Q4', Users: 3420, Paid: 980 },
                    ],
                    null,
                    2
                  )
                )
              }
              className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Load Sample JSON
            </button>
          </div>
          <textarea
            id="chart-raw-input"
            rows={12}
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            className="w-full p-3 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
          />
          {parsed.error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{parsed.error}</p>
          )}
        </div>

        <div className="lg:col-span-7 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <BarChart3 className="w-4 h-4 text-[#4F46E5]" aria-hidden="true" />
              <span>Live Vector Chart Preview</span>
            </span>
            {parsed.dataset && (
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {parsed.dataset.labels.length} rows · {parsed.dataset.series.length} series
              </span>
            )}
          </div>
          {parsed.svg ? (
            <div
              data-testid="chart-svg-preview"
              className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-white p-2"
              dangerouslySetInnerHTML={{ __html: parsed.svg }}
            />
          ) : (
            <div className="h-72 flex items-center justify-center text-xs text-slate-500">
              Fix input data syntax to render chart preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
