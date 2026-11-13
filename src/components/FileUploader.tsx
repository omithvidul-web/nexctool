import { useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, File as FileIcon, Trash2, UploadCloud } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface FileUploaderProps {
  accept: string;
  multiple: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  helperText?: string;
}

export function FileUploader({
  accept,
  multiple,
  files,
  onFilesChange,
  disabled = false,
  helperText,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleIncoming = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const picked = Array.from(incoming);
    if (multiple) {
      onFilesChange([...files, ...picked]);
    } else {
      onFilesChange([picked[0]]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    handleIncoming(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next);
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const copy = [...files];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    onFilesChange(copy);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`relative rounded-[20px] border-2 border-dashed text-center transition-all duration-200 ${
          files.length > 0 ? 'p-4 sm:p-5' : 'p-6 sm:p-8'
        } ${
          isDragging
            ? 'border-[#4F46E5] dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-500/60'
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            handleIncoming(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
          aria-label={multiple ? 'Select files to process' : 'Select a file to process'}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center text-[#4F46E5] dark:text-indigo-300">
            <UploadCloud className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {multiple ? 'Drag and drop files here' : 'Drag and drop your file here'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {helperText || 'Processed 100% locally in your browser · Your file never leaves your device'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-1 inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-[#4F46E5] dark:text-indigo-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full hover:bg-indigo-50/60 dark:hover:bg-slate-700 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            {multiple ? 'Select Files' : 'Choose File'}
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-[20px] divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>
              Selected {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <span className="font-mono tabular-nums">
              Total: {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
            </span>
          </div>
          {files.map((file, idx) => (
            <div key={`${file.name}-${file.size}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {formatBytes(file.size)}
                    {file.type ? ` · ${file.type}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {multiple && files.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => moveFile(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Move ${file.name} up`}
                      className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(idx, 1)}
                      disabled={idx === files.length - 1}
                      aria-label={`Move ${file.name} down`}
                      className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${file.name}`}
                  className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
