import { useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import {
  decodeJwtToken,
  SAMPLE_JWT_TOKEN,
  verifyJwtHmacSignature,
} from '../../utils/jwtHelper';

export function JwtDecoderTool() {
  const [token, setToken] = useState(SAMPLE_JWT_TOKEN);
  const [hmacSecret, setHmacSecret] = useState('');
  const [verifyState, setVerifyState] = useState<{
    status: 'idle' | 'valid' | 'invalid' | 'error';
    message?: string;
  }>({ status: 'idle' });
  const [copiedPart, setCopiedPart] = useState<'header' | 'payload' | null>(null);

  const decoded = useMemo(() => {
    try {
      return { data: decodeJwtToken(token), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unable to parse JWT.',
      };
    }
  }, [token]);

  const handleVerifyHmac = async () => {
    if (!decoded.data) return;
    try {
      const ok = await verifyJwtHmacSignature(
        decoded.data.signingInput,
        decoded.data.signatureB64Url,
        decoded.data.algorithm,
        hmacSecret
      );
      setVerifyState({
        status: ok ? 'valid' : 'invalid',
        message: ok
          ? `Valid ${decoded.data.algorithm} signature!`
          : 'Signature does not match the provided secret.',
      });
    } catch (err) {
      setVerifyState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Verification error.',
      });
    }
  };

  const handleCopyJson = async (part: 'header' | 'payload') => {
    if (!decoded.data) return;
    const json = JSON.stringify(
      part === 'header' ? decoded.data.header : decoded.data.payload,
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(json);
      setCopiedPart(part);
      setTimeout(() => setCopiedPart(null), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      {/* Encoded JWT Input */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="jwt-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Encoded JWT Token (Header.Payload.Signature)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setToken(SAMPLE_JWT_TOKEN);
                setVerifyState({ status: 'idle' });
              }}
              className="px-3 py-1 text-xs font-semibold rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#4F46E5] cursor-pointer"
            >
              Load Sample
            </button>
            <button
              type="button"
              onClick={() => {
                setToken('');
                setVerifyState({ status: 'idle' });
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-500 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        </div>
        <textarea
          id="jwt-input"
          rows={4}
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setVerifyState({ status: 'idle' });
          }}
          placeholder="Paste your eyJ... JWT token here..."
          className="w-full p-3 text-xs font-mono break-all bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
        />
      </div>

      {decoded.error && token.trim().length > 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {decoded.error}
        </div>
      )}

      {decoded.data && (
        <>
          {/* Quick Claims Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Algorithm
              </p>
              <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">
                {decoded.data.algorithm}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Token Status
              </p>
              <p
                className={`text-sm font-semibold mt-1 inline-flex items-center gap-1.5 ${
                  decoded.data.isExpired === true
                    ? 'text-rose-600 dark:text-rose-400'
                    : decoded.data.isExpired === false
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {decoded.data.isExpired === true ? (
                  <>
                    <ShieldAlert className="w-4 h-4" /> Expired
                  </>
                ) : decoded.data.isExpired === false ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Active (Not Expired)
                  </>
                ) : (
                  'No exp claim'
                )}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Issued At (iat)
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-1">
                {decoded.data.issuedAtIso ?? '—'}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expires At (exp)
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-1">
                {decoded.data.expiresAtIso ?? '—'}
              </p>
            </div>
          </div>

          {/* Decoded Header & Payload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Header
                </h3>
                <button
                  type="button"
                  onClick={() => handleCopyJson('header')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#4F46E5] cursor-pointer"
                >
                  {copiedPart === 'header' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPart === 'header' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                {JSON.stringify(decoded.data.header, null, 2)}
              </pre>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Payload (Claims)
                </h3>
                <button
                  type="button"
                  onClick={() => handleCopyJson('payload')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#4F46E5] cursor-pointer"
                >
                  {copiedPart === 'payload' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPart === 'payload' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                {JSON.stringify(decoded.data.payload, null, 2)}
              </pre>
            </div>
          </div>

          {/* Local HMAC Signature Verification */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="jwt-hmac-secret"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Verify HMAC Signature Locally (HS256 / HS384 / HS512)
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Verified inside Web Crypto API — secret never leaves your tab
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <input
                id="jwt-hmac-secret"
                type="text"
                value={hmacSecret}
                onChange={(e) => {
                  setHmacSecret(e.target.value);
                  setVerifyState({ status: 'idle' });
                }}
                placeholder="Enter your signing secret (e.g. your-256-bit-secret)..."
                className="flex-1 min-w-[220px] h-10 px-3.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <button
                type="button"
                disabled={!hmacSecret}
                onClick={handleVerifyHmac}
                className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Verify Signature</span>
              </button>
            </div>

            {verifyState.status !== 'idle' && (
              <p
                className={`text-xs font-semibold ${
                  verifyState.status === 'valid'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {verifyState.message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
