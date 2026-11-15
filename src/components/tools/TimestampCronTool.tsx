import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, Copy, Check } from 'lucide-react';
import {
  convertUnixTimestamp,
  explainAndComputeCron,
} from '../../utils/timestampCronHelper';

const CRON_PRESETS = [
  { label: 'Every 5 min', expr: '*/5 * * * *' },
  { label: 'Hourly', expr: '0 * * * *' },
  { label: 'Weekdays 09:00', expr: '0 9 * * 1-5' },
  { label: 'Monthly 1st', expr: '0 0 1 * *' },
];

export function TimestampCronTool() {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [tsInput, setTsInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [isoLocalInput, setIsoLocalInput] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [cronExpr, setCronExpr] = useState('0 9 * * 1-5');

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const convertedTs = useMemo(() => {
    try {
      return { data: convertUnixTimestamp(tsInput), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Invalid timestamp.',
      };
    }
  }, [tsInput]);

  const reverseTs = useMemo(() => {
    if (!isoLocalInput) return null;
    const d = new Date(isoLocalInput);
    if (Number.isNaN(d.getTime())) return null;
    return {
      seconds: Math.floor(d.getTime() / 1000),
      milliseconds: d.getTime(),
    };
  }, [isoLocalInput]);

  const cronResult = useMemo(() => {
    try {
      return { data: explainAndComputeCron(cronExpr, new Date(), 5), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Invalid cron expression.',
      };
    }
  }, [cronExpr]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Section 1: Unix Timestamp Converter */}
      <section className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Unix Timestamp Converter
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setTsInput(String(nowSec))}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] cursor-pointer"
          >
            <span>Now: {nowSec}</span>
          </button>
        </div>

        <div>
          <label
            htmlFor="unix-ts-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Enter Unix Timestamp (seconds or milliseconds)
          </label>
          <input
            id="unix-ts-input"
            type="text"
            value={tsInput}
            onChange={(e) => setTsInput(e.target.value)}
            className="w-full h-10 px-3.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </div>

        {convertedTs.error ? (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{convertedTs.error}</p>
        ) : (
          convertedTs.data && (
            <div className="space-y-2">
              {[
                { key: 'iso', label: 'ISO 8601 (UTC)', value: convertedTs.data.isoUtc },
                { key: 'utc', label: 'UTC Readable', value: convertedTs.data.utcReadable },
                { key: 'local', label: 'Local Time', value: convertedTs.data.localReadable },
                { key: 'ms', label: 'Milliseconds', value: String(convertedTs.data.milliseconds) },
                { key: 'rel', label: 'Relative', value: convertedTs.data.relativeText },
              ].map((row) => (
                <div
                  key={row.key}
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {row.label}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 truncate">
                      {row.value}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Copy ${row.label}`}
                    onClick={() => handleCopy(row.key, row.value)}
                    className="p-1.5 text-slate-500 hover:text-[#4F46E5] cursor-pointer shrink-0"
                  >
                    {copiedKey === row.key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Human Date -> Unix Timestamp */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <label
            htmlFor="human-date-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Date / Time to Unix Timestamp
          </label>
          <input
            id="human-date-input"
            type="datetime-local"
            value={isoLocalInput}
            onChange={(e) => setIsoLocalInput(e.target.value)}
            className="w-full h-10 px-3.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
          {reverseTs && (
            <p className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
              Seconds: <strong>{reverseTs.seconds}</strong> · ms: <strong>{reverseTs.milliseconds}</strong>
            </p>
          )}
        </div>
      </section>

      {/* Section 2: Cron Expression Explainer */}
      <section className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Cron Expression Explainer
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            min · hour · day · month · weekday
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.expr}
              type="button"
              onClick={() => setCronExpr(preset.expr)}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                cronExpr.trim() === preset.expr
                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div>
          <label
            htmlFor="cron-expr-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            5-Field Cron Expression
          </label>
          <input
            id="cron-expr-input"
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="e.g. */15 * * * *"
            className="w-full h-11 px-3.5 text-base font-mono font-bold tracking-wider bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </div>

        {cronResult.error ? (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{cronResult.error}</p>
        ) : (
          cronResult.data && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Schedule Summary
                </p>
                <p data-testid="cron-summary" className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {cronResult.data.summary}
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: 'Min', val: cronResult.data.fieldBreakdown.minute },
                  { label: 'Hour', val: cronResult.data.fieldBreakdown.hour },
                  { label: 'Day', val: cronResult.data.fieldBreakdown.dayOfMonth },
                  { label: 'Month', val: cronResult.data.fieldBreakdown.month },
                  { label: 'Weekday', val: cronResult.data.fieldBreakdown.dayOfWeek },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <p className="text-[10px] font-semibold uppercase text-slate-500">{f.label}</p>
                    <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={f.val}>
                      {f.val}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Next 5 Scheduled Runs (UTC)
                </p>
                <ul className="space-y-1.5">
                  {cronResult.data.nextRunsUtc.map((ts, idx) => (
                    <li
                      key={`${ts}-${idx}`}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200"
                    >
                      #{idx + 1} · {ts}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}
