import { useState } from 'react';
import { Check, Copy, Download, KeyRound, RefreshCw, Sparkles } from 'lucide-react';
import {
  generateSecurePassword,
  generateUuidV4Batch,
  type PasswordOptions,
} from '../../utils/passwordUuidHelper';

export function PasswordUuidTool() {
  const [opts, setOpts] = useState<PasswordOptions>({
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [pwResult, setPwResult] = useState(() =>
    generateSecurePassword({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      excludeAmbiguous: false,
    })
  );
  const [copiedPw, setCopiedPw] = useState(false);

  const [uuidCount, setUuidCount] = useState(10);
  const [uuidUppercase, setUuidUppercase] = useState(false);
  const [uuidNoHyphens, setUuidNoHyphens] = useState(false);
  const [uuids, setUuids] = useState<string[]>(() => generateUuidV4Batch(10, false, false));
  const [copiedUuids, setCopiedUuids] = useState(false);

  const updatePwOpts = (patch: Partial<PasswordOptions>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    setPwResult(generateSecurePassword(next));
  };

  const regenerateUuids = (
    nextCount = uuidCount,
    nextUpper = uuidUppercase,
    nextNoHyphens = uuidNoHyphens
  ) => {
    const clamped = Math.max(1, Math.min(500, Math.round(nextCount) || 1));
    setUuidCount(clamped);
    setUuidUppercase(nextUpper);
    setUuidNoHyphens(nextNoHyphens);
    setUuids(generateUuidV4Batch(clamped, nextUpper, nextNoHyphens));
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(pwResult.password);
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 1600);
    } catch {
      // ignore
    }
  };

  const handleCopyUuids = async () => {
    try {
      await navigator.clipboard.writeText(uuids.join('\n'));
      setCopiedUuids(true);
      setTimeout(() => setCopiedUuids(false), 1600);
    } catch {
      // ignore
    }
  };

  const handleDownloadUuids = (ext: 'txt' | 'json') => {
    const content = ext === 'json' ? JSON.stringify(uuids, null, 2) : uuids.join('\n');
    const blob = new Blob([content], {
      type: ext === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uuids-v4-${uuids.length}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const strengthColor =
    pwResult.strengthLabel === 'Very Strong'
      ? 'text-emerald-600 dark:text-emerald-400'
      : pwResult.strengthLabel === 'Strong'
        ? 'text-indigo-600 dark:text-indigo-400'
        : pwResult.strengthLabel === 'Fair'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Strong Password Generator */}
      <section className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Strong Password Generator
            </h2>
          </div>
          <span className={`text-xs font-semibold tabular-nums ${strengthColor}`}>
            {pwResult.strengthLabel} · {pwResult.entropyBits} bits
          </span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
          <code
            data-testid="generated-password"
            className="text-sm font-mono font-semibold text-slate-900 dark:text-white break-all select-all"
          >
            {pwResult.password}
          </code>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Regenerate password"
              onClick={() => setPwResult(generateSecurePassword(opts))}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCopyPassword}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-xs font-semibold cursor-pointer"
            >
              {copiedPw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPw ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            <label htmlFor="pw-length-range">Password Length</label>
            <span className="font-mono tabular-nums">{opts.length} chars</span>
          </div>
          <input
            id="pw-length-range"
            type="range"
            min={8}
            max={64}
            value={opts.length}
            onChange={(e) => updatePwOpts({ length: Number(e.target.value) })}
            className="w-full accent-[#4F46E5]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.uppercase}
              onChange={(e) => updatePwOpts({ uppercase: e.target.checked })}
              className="accent-[#4F46E5]"
            />
            <span>Uppercase (A-Z)</span>
          </label>
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.lowercase}
              onChange={(e) => updatePwOpts({ lowercase: e.target.checked })}
              className="accent-[#4F46E5]"
            />
            <span>Lowercase (a-z)</span>
          </label>
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.numbers}
              onChange={(e) => updatePwOpts({ numbers: e.target.checked })}
              className="accent-[#4F46E5]"
            />
            <span>Numbers (0-9)</span>
          </label>
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.symbols}
              onChange={(e) => updatePwOpts({ symbols: e.target.checked })}
              className="accent-[#4F46E5]"
            />
            <span>Symbols (!@#$%)</span>
          </label>
          <label className="col-span-2 flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.excludeAmbiguous}
              onChange={(e) => updatePwOpts({ excludeAmbiguous: e.target.checked })}
              className="accent-[#4F46E5]"
            />
            <span>Exclude ambiguous characters (0, O, o, 1, l, I)</span>
          </label>
        </div>
      </section>

      {/* Bulk UUID v4 Generator */}
      <section className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Bulk UUID v4 Generator
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {uuids.length} generated
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="uuid-count-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Count (1-500)
            </label>
            <input
              id="uuid-count-input"
              type="number"
              min={1}
              max={500}
              value={uuidCount}
              onChange={(e) => regenerateUuids(Number(e.target.value), uuidUppercase, uuidNoHyphens)}
              className="w-24 h-9 px-2.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={uuidUppercase}
              onChange={(e) => regenerateUuids(uuidCount, e.target.checked, uuidNoHyphens)}
              className="accent-[#4F46E5]"
            />
            <span>UPPERCASE</span>
          </label>

          <label className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={uuidNoHyphens}
              onChange={(e) => regenerateUuids(uuidCount, uuidUppercase, e.target.checked)}
              className="accent-[#4F46E5]"
            />
            <span>No Hyphens</span>
          </label>

          <button
            type="button"
            onClick={() => regenerateUuids()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate</span>
          </button>
        </div>

        <textarea
          aria-label="Generated UUID v4 list"
          readOnly
          rows={7}
          value={uuids.join('\n')}
          className="w-full p-3 text-xs font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUuids}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] cursor-pointer"
          >
            {copiedUuids ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUuids ? 'Copied All' : 'Copy All'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownloadUuids('txt')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownloadUuids('json')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-emerald-500 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .json</span>
          </button>
        </div>
      </section>
    </div>
  );
}
