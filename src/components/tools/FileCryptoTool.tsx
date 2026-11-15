import { useRef, useState } from 'react';
import { Download, Eye, EyeOff, FileUp, Lock, ShieldCheck, Unlock } from 'lucide-react';
import { decryptBytesAesGcm, encryptBytesAesGcm } from '../../utils/fileCryptoHelper';
import { formatBytes } from '../../utils/formatters';

type CryptoMode = 'encrypt' | 'decrypt';

export function FileCryptoTool() {
  const [mode, setMode] = useState<CryptoMode>('encrypt');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    filename: string;
    bytes: Uint8Array;
    originalSize: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setResult(null);
    setError(null);
    if (file.name.toLowerCase().endsWith('.nexenc')) {
      setMode('decrypt');
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }
    if (!password) {
      setError('Please enter a strong password.');
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const inputBytes = new Uint8Array(buffer);

      if (mode === 'encrypt') {
        const encrypted = await encryptBytesAesGcm(inputBytes, selectedFile.name, password);
        setResult({
          filename: `${selectedFile.name}.nexenc`,
          bytes: encrypted,
          originalSize: inputBytes.byteLength,
        });
      } else {
        const decrypted = await decryptBytesAesGcm(inputBytes, password);
        setResult({
          filename: decrypted.filename,
          bytes: decrypted.data,
          originalSize: inputBytes.byteLength,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encryption/decryption failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const copy = new Uint8Array(result.bytes.byteLength);
    copy.set(result.bytes);
    const blob = new Blob([copy.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Mode Switch + Security Summary */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('encrypt');
              setResult(null);
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer ${
              mode === 'encrypt'
                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Encrypt File</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('decrypt');
              setResult(null);
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer ${
              mode === 'decrypt'
                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Decrypt (.nexenc)</span>
          </button>
        </div>

        <div className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>AES-256-GCM · PBKDF2-SHA256 (310,000 iterations)</span>
        </div>
      </div>

      {/* File Dropzone + Password Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileChange(e.dataTransfer.files[0]);
          }}
          className="p-6 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#4F46E5] rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors min-h-[168px]"
        >
          <FileUp className="w-7 h-7 text-[#4F46E5] dark:text-indigo-400 mb-2" aria-hidden="true" />
          {selectedFile ? (
            <>
              <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                {selectedFile.name}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                {formatBytes(selectedFile.size)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {mode === 'encrypt' ? 'Select any file to encrypt' : 'Select a .nexenc encrypted file'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Click or drop file here — processed 100% in browser RAM
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={mode === 'decrypt' ? '.nexenc,*/*' : '*/*'}
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-4">
          <div>
            <label
              htmlFor="crypto-password-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {mode === 'encrypt' ? 'Encryption Password' : 'Decryption Password'}
            </label>
            <div className="relative">
              <input
                id="crypto-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong passphrase..."
                className="w-full h-11 pl-3.5 pr-11 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {mode === 'encrypt'
                ? 'Keep this password safe—it cannot be recovered if lost. Original filename is stored inside the encrypted header.'
                : 'Enter the exact password used during encryption to restore the original filename and file contents.'}
            </p>
          </div>

          <button
            type="button"
            disabled={busy || !selectedFile || !password}
            onClick={handleProcess}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {mode === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>
              {busy
                ? mode === 'encrypt'
                  ? 'Encrypting...'
                  : 'Decrypting...'
                : mode === 'encrypt'
                  ? 'Encrypt File Locally'
                  : 'Decrypt File Locally'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {mode === 'encrypt' ? 'File encrypted with AES-256-GCM' : 'File decrypted & verified'}
            </p>
            <p className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5">
              {result.filename} · {formatBytes(result.bytes.byteLength)} (input {formatBytes(result.originalSize)})
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download {mode === 'encrypt' ? '.nexenc' : 'Restored File'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
