import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DevPreviewKind, ToolItem } from '../data/tools';
import {
  buildCssPreviewDocument,
  buildStandalonePreviewHtml,
  computeLineDiff,
  evaluateRegexMatches,
  formatSqlPreview,
  renderMarkdownToHtml,
  runOfflinePythonFallback,
} from '../utils/devPreviewLogic';
import { formatBytes } from '../utils/formatters';

interface SamplePreset {
  filename: string;
  mimeType: string;
  code: string;
  secondaryCode?: string;
}

const PRESETS: Record<DevPreviewKind, SamplePreset> = {
  html: {
    filename: 'index.html',
    mimeType: 'text/html;charset=utf-8',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #ffffff; color: #0f172a; }
    .card { max-width: 520px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 600; }
    h1 { margin: 12px 0 8px; font-size: 22px; }
    p { margin: 0 0 16px; color: #475569; line-height: 1.5; }
    button { background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Live HTML Preview</span>
    <h1>Hello from NexcTool!</h1>
    <p>Edit this HTML code or paste your own document above to preview it live and download as an .html file.</p>
    <button onclick="document.getElementById('msg').textContent = 'Button clicked inside sandboxed preview!'">Test Interaction</button>
    <p id="msg" style="margin-top: 12px; font-weight: 600; color: #2563eb;"></p>
  </div>
</body>
</html>`,
  },
  css: {
    filename: 'styles.css',
    mimeType: 'text/css;charset=utf-8',
    code: `/* Edit or paste CSS rules here to style the live sample elements */
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #ffffff;
  color: #0f172a;
  padding: 24px;
  margin: 0;
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.08);
  max-width: 540px;
}

h1 {
  font-size: 22px;
  color: #1e293b;
  margin: 0 0 8px;
}

p {
  color: #475569;
  line-height: 1.6;
  margin: 0 0 18px;
}

.btn-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 600;
  margin-left: 8px;
  cursor: pointer;
}`,
  },
  javascript: {
    filename: 'script.js',
    mimeType: 'application/javascript;charset=utf-8',
    code: `// Runs 100% inside your browser
const tools = ['HTML Preview', 'CSS Preview', 'JavaScript Runner', 'JSON Viewer'];

console.log('NexcTool Browser Runner Ready');
console.log('Loaded tools count:', tools.length);

const totals = [12, 24, 36].map((n) => n * 2);
console.info('Mapped numbers:', totals);

if (totals[2] > 50) {
  console.warn('Sample warning: value exceeded 50 ->', totals[2]);
}

return 'Finished cleanly';`,
  },
  python: {
    filename: 'main.py',
    mimeType: 'text/x-python;charset=utf-8',
    code: `# Runs client-side in your browser
name = "NexcTool"
items = [10, 20, 30, 40]

print(f"Hello from {name} Python Runner!")
print("Total items:", len(items))
print("Sum:", sum(items))

for i in range(3):
    print(f"Step {i + 1} complete")`,
  },
  'json-tree': {
    filename: 'data.json',
    mimeType: 'application/json;charset=utf-8',
    code: `{
  "app": "NexcTool",
  "privacy": "100% Client-Side",
  "version": 2.4,
  "active": true,
  "categories": [
    { "name": "Image Tools", "count": 30 },
    { "name": "PDF Tools", "count": 30 },
    { "name": "Text & Developer Tools", "count": 27 }
  ],
  "settings": {
    "uploadsToServer": false,
    "offlineReady": true,
    "accentColor": "#2563EB"
  }
}`,
  },
  markdown: {
    filename: 'document.md',
    mimeType: 'text/markdown;charset=utf-8',
    code: `# NexcTool Markdown Preview

Write or paste **Markdown** on the left and watch the live HTML preview update on the right.

## Key Features
- 100% Private — runs inside your browser
- Supports **bold**, *italic*, and \`inline code\`
- Instant file download as \`.md\` or \`.html\`

> "Your file never leaves your device."

### Sample Code Block
\`\`\`ts
export function greet(user: string) {
  return \`Welcome to NexcTool, \${user}!\`;
}
\`\`\`

1. Edit or paste Markdown
2. Check the live rendered preview
3. Click **Download File** to save locally`,
  },
  'xml-tree': {
    filename: 'data.xml',
    mimeType: 'application/xml;charset=utf-8',
    code: `<?xml version="1.0" encoding="UTF-8"?>
<catalog app="NexcTool" private="true">
  <category slug="text-developer-tools">
    <tool id="201" type="preview">
      <name>HTML Preview</name>
      <status>Active</status>
    </tool>
    <tool id="207" type="viewer">
      <name>XML Viewer</name>
      <status>Active</status>
    </tool>
  </category>
  <notes>All XML parsing stays in your browser DOMParser.</notes>
</catalog>`,
  },
  sql: {
    filename: 'query.sql',
    mimeType: 'application/sql;charset=utf-8',
    code: `select u.id, u.full_name, u.email, count(o.id) as order_count, sum(o.total_amount) as lifetime_value from users u left join orders o on u.id = o.user_id where u.status = 'active' and o.created_at >= '2025-01-01' group by u.id, u.full_name, u.email having count(o.id) > 2 order by lifetime_value desc limit 25;`,
  },
  regex: {
    filename: 'regex-test.txt',
    mimeType: 'text/plain;charset=utf-8',
    code: `Contact support@nexctool.com or billing@example.org for invoices.
Backup email: admin.team+alerts@dev-portal.io
Invalid entries: user@, @missing-local.com`,
  },
  diff: {
    filename: 'changes.diff',
    mimeType: 'text/plain;charset=utf-8',
    code: `NexcTool Browser Tools
Version: 1.0
Privacy: 100% Client-Side
Offline Support: Basic
Theme: Light Blue`,
    secondaryCode: `NexcTool Browser Tools
Version: 2.0
Privacy: 100% Client-Side
Offline Support: Full Service Cache
Developer Previews: Enabled
Theme: Light Blue`,
  },
};

function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const safeName = filename.trim() || 'download.txt';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ConsoleEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'return';
  text: string;
}

function serializeConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function executeJavaScriptCode(code: string): { entries: ConsoleEntry[]; durationMs: number } {
  const entries: ConsoleEntry[] = [];
  const customConsole = {
    log: (...args: unknown[]) => entries.push({ level: 'log', text: args.map(serializeConsoleArg).join(' ') }),
    info: (...args: unknown[]) => entries.push({ level: 'info', text: args.map(serializeConsoleArg).join(' ') }),
    warn: (...args: unknown[]) => entries.push({ level: 'warn', text: args.map(serializeConsoleArg).join(' ') }),
    error: (...args: unknown[]) => entries.push({ level: 'error', text: args.map(serializeConsoleArg).join(' ') }),
    table: (data: unknown) => entries.push({ level: 'log', text: serializeConsoleArg(data) }),
  };

  const start = performance.now();
  try {
    const fn = new Function('console', code);
    const ret = fn(customConsole);
    if (ret !== undefined) {
      entries.push({ level: 'return', text: `↳ Return: ${serializeConsoleArg(ret)}` });
    }
  } catch (err) {
    entries.push({
      level: 'error',
      text: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
  }
  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  return {
    entries: entries.length > 0 ? entries : [{ level: 'info', text: '(Executed with no console output)' }],
    durationMs,
  };
}

interface PyodideInstance {
  setStdout: (opts: { batched: (msg: string) => void }) => void;
  setStderr: (opts: { batched: (msg: string) => void }) => void;
  runPythonAsync: (code: string) => Promise<unknown>;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
    __nexctoolPyodidePromise?: Promise<PyodideInstance>;
  }
}

async function getPyodideRuntime(): Promise<PyodideInstance> {
  if (window.__nexctoolPyodidePromise) {
    return window.__nexctoolPyodidePromise;
  }

  window.__nexctoolPyodidePromise = new Promise<PyodideInstance>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Pyodide CDN timed out'));
    }, 9000);

    const init = () => {
      if (!window.loadPyodide) {
        window.clearTimeout(timer);
        reject(new Error('Pyodide loader unavailable'));
        return;
      }
      window
        .loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' })
        .then((py) => {
          window.clearTimeout(timer);
          resolve(py);
        })
        .catch((err) => {
          window.clearTimeout(timer);
          reject(err);
        });
    };

    if (window.loadPyodide) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Failed to load Pyodide script'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    window.__nexctoolPyodidePromise = undefined;
    throw err;
  });

  return window.__nexctoolPyodidePromise;
}

function JsonTreeNode({
  label,
  value,
  depth,
  expandVersion,
  defaultExpanded,
}: {
  label?: string;
  value: unknown;
  depth: number;
  expandVersion: number;
  defaultExpanded: boolean;
}) {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object';
  const [expanded, setExpanded] = useState(depth < 2 ? true : defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [expandVersion, defaultExpanded]);

  if (!isObject) {
    let valueColor = 'text-slate-800 dark:text-slate-200';
    let formatted = String(value);
    if (typeof value === 'string') {
      valueColor = 'text-emerald-700 dark:text-emerald-400';
      formatted = `"${value}"`;
    } else if (typeof value === 'number') {
      valueColor = 'text-indigo-600 dark:text-indigo-400';
    } else if (typeof value === 'boolean') {
      valueColor = 'text-violet-700 dark:text-violet-400';
    } else if (value === null) {
      valueColor = 'text-slate-400 dark:text-slate-500 italic';
      formatted = 'null';
    }

    return (
      <div className="flex items-baseline gap-1.5 py-0.5 font-mono text-xs sm:text-sm leading-relaxed">
        {label !== undefined && (
          <span className="text-slate-700 dark:text-slate-300 font-semibold shrink-0">{label}:</span>
        )}
        <span className={`${valueColor} break-all`}>{formatted}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div className="font-mono text-xs sm:text-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -ml-1 cursor-pointer transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
        )}
        {label !== undefined && (
          <span className="text-slate-800 dark:text-slate-200 font-semibold">{label}:</span>
        )}
        <span className="text-slate-500 dark:text-slate-400">{openBracket}</span>
        {!expanded && (
          <span className="text-slate-400 dark:text-slate-500 text-xs">
            {entries.length} {isArray ? 'items' : 'keys'} {closeBracket}
          </span>
        )}
      </button>

      {expanded && (
        <div className="pl-4 ml-1.5 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
          {entries.length === 0 ? (
            <div className="text-slate-400 dark:text-slate-500 text-xs italic py-0.5">(empty)</div>
          ) : (
            entries.map(([k, v]) => (
              <JsonTreeNode
                key={k}
                label={k}
                value={v}
                depth={depth + 1}
                expandVersion={expandVersion}
                defaultExpanded={defaultExpanded}
              />
            ))
          )}
          <div className="text-slate-500 dark:text-slate-400">{closeBracket}</div>
        </div>
      )}
    </div>
  );
}

interface ParsedXmlNode {
  type: 'element' | 'text' | 'comment';
  name: string;
  attributes: { name: string; value: string }[];
  textContent: string;
  children: ParsedXmlNode[];
}

function escapeXmlHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function domNodeToParsed(node: ChildNode): ParsedXmlNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const trimmed = (node.textContent ?? '').trim();
    if (!trimmed) return null;
    return {
      type: 'text',
      name: '#text',
      attributes: [],
      textContent: trimmed,
      children: [],
    };
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return {
      type: 'comment',
      name: '#comment',
      attributes: [],
      textContent: (node.textContent ?? '').trim(),
      children: [],
    };
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const attributes = Array.from(el.attributes).map((attr) => ({
      name: attr.name,
      value: attr.value,
    }));
    const children: ParsedXmlNode[] = [];
    el.childNodes.forEach((child) => {
      const converted = domNodeToParsed(child);
      if (converted) children.push(converted);
    });
    return {
      type: 'element',
      name: el.tagName,
      attributes,
      textContent: '',
      children,
    };
  }
  return null;
}

function parsedXmlToStandaloneHtml(node: ParsedXmlNode): string {
  if (node.type === 'text') {
    return `<div class="xml-text">"${escapeXmlHtml(node.textContent)}"</div>`;
  }
  if (node.type === 'comment') {
    return `<div class="xml-comment">&lt;!-- ${escapeXmlHtml(node.textContent)} --&gt;</div>`;
  }
  const attrs = node.attributes
    .map(
      (a) =>
        ` <span class="xml-attr-name">${escapeXmlHtml(a.name)}</span>=<span class="xml-attr-val">"${escapeXmlHtml(
          a.value
        )}"</span>`
    )
    .join('');

  const singleText =
    node.children.length === 1 && node.children[0].type === 'text'
      ? node.children[0].textContent
      : null;

  if (node.children.length === 0) {
    return `<div><span class="xml-tag">&lt;${escapeXmlHtml(node.name)}</span>${attrs}<span class="xml-tag"> /&gt;</span></div>`;
  }
  if (singleText !== null) {
    return `<div><span class="xml-tag">&lt;${escapeXmlHtml(node.name)}</span>${attrs}<span class="xml-tag">&gt;</span><span>${escapeXmlHtml(
      singleText
    )}</span><span class="xml-tag">&lt;/${escapeXmlHtml(node.name)}&gt;</span></div>`;
  }

  return `<details open class="xml-node">
    <summary><span class="xml-tag">&lt;${escapeXmlHtml(node.name)}</span>${attrs}<span class="xml-tag">&gt;</span></summary>
    <div class="xml-children">${node.children.map(parsedXmlToStandaloneHtml).join('')}</div>
    <div class="xml-tag">&lt;/${escapeXmlHtml(node.name)}&gt;</div>
  </details>`;
}

function XmlTreeNodeView({
  node,
  expandVersion,
  defaultExpanded,
}: {
  node: ParsedXmlNode;
  expandVersion: number;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [expandVersion, defaultExpanded]);

  if (node.type === 'text') {
    return (
      <div className="font-mono text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 py-0.5 break-all">
        "{node.textContent}"
      </div>
    );
  }

  if (node.type === 'comment') {
    return (
      <div className="font-mono text-xs text-slate-400 dark:text-slate-500 italic py-0.5">
        &lt;!-- {node.textContent} --&gt;
      </div>
    );
  }

  const singleTextChild =
    node.children.length === 1 && node.children[0].type === 'text' ? node.children[0].textContent : null;

  const attrSummary = node.attributes.map((a) => (
    <span key={a.name} className="ml-1.5">
      <span className="text-amber-700 dark:text-amber-300">{a.name}</span>
      <span className="text-slate-400 dark:text-slate-500">=</span>
      <span className="text-emerald-700 dark:text-emerald-400">"{a.value}"</span>
    </span>
  ));

  if (node.children.length === 0 || singleTextChild !== null) {
    return (
      <div className="font-mono text-xs sm:text-sm py-0.5 leading-relaxed">
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">&lt;{node.name}</span>
        {attrSummary}
        {singleTextChild !== null ? (
          <>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">&gt;</span>
            <span className="text-slate-800 dark:text-slate-200">{singleTextChild}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">&lt;/{node.name}&gt;</span>
          </>
        ) : (
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold"> /&gt;</span>
        )}
      </div>
    );
  }

  return (
    <div className="font-mono text-xs sm:text-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -ml-1 cursor-pointer transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
        )}
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">&lt;{node.name}</span>
        {attrSummary}
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">&gt;</span>
        {!expanded && (
          <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">
            ... &lt;/{node.name}&gt;
          </span>
        )}
      </button>

      {expanded && (
        <div className="pl-4 ml-1.5 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
          {node.children.map((child, i) => (
            <XmlTreeNodeView
              key={`${child.name}-${i}`}
              node={child}
              expandVersion={expandVersion}
              defaultExpanded={defaultExpanded}
            />
          ))}
          <div className="text-indigo-600 dark:text-indigo-400 font-semibold">&lt;/{node.name}&gt;</div>
        </div>
      )}
    </div>
  );
}

interface PreviewBoxShellProps {
  title: string;
  badge?: ReactNode;
  extraActions?: ReactNode;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExitFullscreen: () => void;
  onOpenNewTab: () => void;
  blockedBlobUrl: string | null;
  children: ReactNode;
}

function PreviewBoxShell({
  title,
  badge,
  extraActions,
  isFullscreen,
  onToggleFullscreen,
  onExitFullscreen,
  onOpenNewTab,
  blockedBlobUrl,
  children,
}: PreviewBoxShellProps) {
  return (
    <div
      data-testid="preview-box-container"
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-white dark:bg-[#090D16] flex flex-col'
          : 'border border-slate-200/90 dark:border-slate-800 rounded-[20px] overflow-hidden bg-white dark:bg-slate-900 flex flex-col shadow-sm'
      }
    >
      {/* Top Preview Action Bar: [Preview] + [Open Preview in New Tab ↗] + [Fullscreen] */}
      <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</span>
          {badge}
          {extraActions}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onExitFullscreen}
            aria-pressed={!isFullscreen}
            data-testid="preview-inline-button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              !isFullscreen
                ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-sm shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Preview</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewTab}
            data-testid="open-preview-new-tab"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-[#4F46E5] dark:hover:text-indigo-400 text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>Open Preview in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-pressed={isFullscreen}
            data-testid="toggle-preview-fullscreen"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              isFullscreen
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {blockedBlobUrl && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 border-b border-indigo-200 dark:border-indigo-900 flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
          <span>Pop-up blocked by browser — open your standalone preview directly:</span>
          <a
            href={blockedBlobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#4F46E5] dark:text-indigo-400 underline shrink-0"
          >
            Open Preview Tab ↗
          </a>
        </div>
      )}

      <div className={isFullscreen ? 'flex-1 overflow-auto bg-white dark:bg-[#090D16] flex flex-col' : 'flex-1 flex flex-col'}>
        {children}
      </div>
    </div>
  );
}

export function DeveloperPreviewTool({ tool }: { tool: ToolItem }) {
  const kind = tool.previewKind ?? 'html';
  const preset = PRESETS[kind];

  const [code, setCode] = useState(preset.code);
  const [secondaryCode, setSecondaryCode] = useState(preset.secondaryCode ?? '');
  const [filename, setFilename] = useState(preset.filename);
  const [copied, setCopied] = useState(false);

  // Fullscreen + new-tab fallback state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blockedBlobUrl, setBlockedBlobUrl] = useState<string | null>(null);
  const createdBlobUrlsRef = useRef<string[]>([]);

  // Runner states (JS & Python)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [runnerDurationMs, setRunnerDurationMs] = useState<number | null>(null);
  const [pythonOutput, setPythonOutput] = useState('');
  const [pythonRunning, setPythonRunning] = useState(false);
  const [pythonEngineLabel, setPythonEngineLabel] = useState<string>('');

  // Tree states (JSON & XML)
  const [treeExpandVersion, setTreeExpandVersion] = useState(0);
  const [treeDefaultExpanded, setTreeDefaultExpanded] = useState(true);

  // SQL options
  const [sqlUppercase, setSqlUppercase] = useState(true);
  const [sqlIndent, setSqlIndent] = useState<2 | 4>(2);

  // Regex states
  const [regexPattern, setRegexPattern] = useState(
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'
  );
  const [regexFlags, setRegexFlags] = useState('g');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset editor whenever tool changes
  useEffect(() => {
    const nextPreset = PRESETS[kind];
    setCode(nextPreset.code);
    setSecondaryCode(nextPreset.secondaryCode ?? '');
    setFilename(nextPreset.filename);
    setCopied(false);
    setIsFullscreen(false);
    setBlockedBlobUrl(null);
    setConsoleLogs([]);
    setRunnerDurationMs(null);
    setPythonOutput('');
    setPythonRunning(false);
    setPythonEngineLabel('');
    setTreeDefaultExpanded(true);
    setTreeExpandVersion((v) => v + 1);
  }, [kind, tool.slug]);

  // Escape exits fullscreen inside page
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Cleanup generated preview Blob URLs on unmount
  useEffect(() => {
    return () => {
      createdBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdBlobUrlsRef.current = [];
    };
  }, []);

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCode(text);
    setFilename(file.name);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard ignored
    }
  };

  const handleRunJavaScript = () => {
    const { entries, durationMs } = executeJavaScriptCode(code);
    setRunnerDurationMs(durationMs);
    setConsoleLogs(entries);
    return { entries, durationMs };
  };

  const handleRunPython = async (): Promise<{ output: string; engine: string; durationMs: number }> => {
    setPythonRunning(true);
    const start = performance.now();
    const outChunks: string[] = [];
    let outputText = '';
    let engineLabel = '';

    try {
      const pyodide = await getPyodideRuntime();
      pyodide.setStdout({ batched: (msg) => outChunks.push(msg) });
      pyodide.setStderr({ batched: (msg) => outChunks.push(`[stderr] ${msg}`) });
      const result = await pyodide.runPythonAsync(code);
      if (result !== undefined && outChunks.length === 0) {
        outChunks.push(String(result));
      }
      engineLabel = 'Pyodide WebAssembly Runtime';
      outputText = outChunks.join('\n') || '(No output printed)';
    } catch {
      outputText = runOfflinePythonFallback(code);
      engineLabel = 'Built-in Offline Python Engine';
    }
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    setPythonEngineLabel(engineLabel);
    setPythonOutput(outputText);
    setRunnerDurationMs(durationMs);
    setPythonRunning(false);
    return { output: outputText, engine: engineLabel, durationMs };
  };

  // Parsed JSON result for json-tree
  const parsedJson = useMemo(() => {
    if (kind !== 'json-tree') return null;
    if (!code.trim()) {
      return { valid: false as const, error: 'Paste JSON content to preview the interactive tree.' };
    }
    try {
      const data = JSON.parse(code);
      const topKeys = Array.isArray(data)
        ? `${data.length} array items`
        : data !== null && typeof data === 'object'
          ? `${Object.keys(data).length} root keys`
          : typeof data;
      return { valid: true as const, data, summary: topKeys };
    } catch (err) {
      return {
        valid: false as const,
        error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
      };
    }
  }, [kind, code]);

  // Parsed XML result for xml-tree
  const parsedXml = useMemo(() => {
    if (kind !== 'xml-tree') return null;
    if (!code.trim()) {
      return { valid: false as const, error: 'Paste XML content to inspect the tree structure.' };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return {
        valid: false as const,
        error: parserError.textContent?.trim() || 'Invalid XML markup.',
      };
    }
    const rootNode = doc.documentElement ? domNodeToParsed(doc.documentElement) : null;
    return { valid: true as const, rootNode };
  }, [kind, code]);

  const markdownHtml = useMemo(() => {
    if (kind !== 'markdown') return '';
    return renderMarkdownToHtml(code);
  }, [kind, code]);

  const formattedSql = useMemo(() => {
    if (kind !== 'sql') return '';
    return formatSqlPreview(code, { uppercase: sqlUppercase, indentSpaces: sqlIndent });
  }, [kind, code, sqlUppercase, sqlIndent]);

  const regexEval = useMemo(() => {
    if (kind !== 'regex') return null;
    return evaluateRegexMatches(regexPattern, regexFlags, code);
  }, [kind, regexPattern, regexFlags, code]);

  const diffResult = useMemo(() => {
    if (kind !== 'diff') return null;
    return computeLineDiff(code, secondaryCode);
  }, [kind, code, secondaryCode]);

  const toggleRegexFlag = (flag: string) => {
    setRegexFlags((prev) => (prev.includes(flag) ? prev.replace(flag, '') : `${prev}${flag}`));
  };

  const handleOpenPreviewInNewTab = () => {
    setBlockedBlobUrl(null);
    let activeLogs = consoleLogs;
    let activeDuration = runnerDurationMs;
    let activePyOutput = pythonOutput;
    let activePyEngine = pythonEngineLabel;

    if (kind === 'javascript' && activeLogs.length === 0) {
      const runRes = handleRunJavaScript();
      activeLogs = runRes.entries;
      activeDuration = runRes.durationMs;
    }

    if (kind === 'python' && !activePyOutput) {
      activePyOutput = runOfflinePythonFallback(code);
      activePyEngine = 'Built-in Offline Python Engine';
      setPythonOutput(activePyOutput);
      setPythonEngineLabel(activePyEngine);
    }

    const xmlMarkupBody =
      kind === 'xml-tree'
        ? parsedXml?.valid && parsedXml.rootNode
          ? parsedXmlToStandaloneHtml(parsedXml.rootNode)
          : `<div class="error-box">${escapeXmlHtml(
              parsedXml?.valid === false ? parsedXml.error : 'Empty XML document.'
            )}</div>`
        : undefined;

    const standaloneHtml = buildStandalonePreviewHtml({
      kind,
      code,
      consoleEntries: activeLogs,
      pythonOutput: activePyOutput,
      pythonEngineLabel: activePyEngine,
      durationMs: activeDuration,
      sqlUppercase,
      sqlIndent,
      regexPattern,
      regexFlags,
      diffModifiedText: secondaryCode,
      xmlMarkupBody,
    });

    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    createdBlobUrlsRef.current.push(url);

    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      setBlockedBlobUrl(url);
    }
  };

  const downloadContent = useMemo(() => {
    if (kind === 'sql') return formattedSql || code;
    if (kind === 'diff' && diffResult) {
      return diffResult.lines
        .map((l) => `${l.type === 'added' ? '+' : l.type === 'removed' ? '-' : ' '} ${l.text}`)
        .join('\n');
    }
    return code;
  }, [kind, code, formattedSql, diffResult]);

  const byteSize = useMemo(() => new Blob([downloadContent]).size, [downloadContent]);

  return (
    <div className="space-y-4">
      {/* Unified Top Toolbar: Upload + Sample + Clear + Filename + Download File */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={tool.accept}
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-full transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <span>Open File</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCode(preset.code);
              setSecondaryCode(preset.secondaryCode ?? '');
              setFilename(preset.filename);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-full transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCode('');
              setSecondaryCode('');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:text-red-600 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-full transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(downloadContent)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-full transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Download pasted code as file */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full px-3 h-8">
            <FileCode2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-1.5 shrink-0" aria-hidden="true" />
            <input
              type="text"
              aria-label="Download filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-28 sm:w-32 text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => triggerFileDownload(downloadContent, filename, preset.mimeType)}
            disabled={!downloadContent}
            data-testid="download-code-file"
            className="inline-flex items-center gap-1.5 px-4 h-8 bg-[#16A34A] hover:bg-[#15803D] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-full shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download File ({formatBytes(byteSize)})</span>
          </button>

          {kind === 'markdown' && (
            <button
              type="button"
              onClick={() =>
                triggerFileDownload(
                  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Markdown Export</title></head><body>${markdownHtml}</body></html>`,
                  filename.replace(/\.[^.]+$/, '') + '.html',
                  'text/html;charset=utf-8'
                )
              }
              disabled={!code.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-full transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
              <span>Export .html</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. HTML PREVIEW */}
      {kind === 'html' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              HTML Source Code
            </label>
            <textarea
              id="dev-code-editor"
              rows={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste or type HTML code here..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <PreviewBoxShell
            title="Live HTML Preview"
            badge={<span className="text-xs text-slate-500 dark:text-slate-400 font-normal">Updates live</span>}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <iframe
              title="HTML Live Preview"
              sandbox="allow-scripts"
              srcDoc={code}
              className={`w-full bg-white border-0 ${isFullscreen ? 'flex-1 h-full' : 'h-80'}`}
            />
          </PreviewBoxShell>
        </div>
      )}

      {/* 2. CSS PREVIEW */}
      {kind === 'css' && (
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="dev-code-editor" className="text-sm font-bold text-slate-800 dark:text-slate-200">
                CSS Stylesheet Input
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Available targets: <code className="font-mono text-slate-700 dark:text-slate-300">body, .card, h1, p, .btn-primary, .btn-secondary</code>
              </span>
            </div>
            <textarea
              id="dev-code-editor"
              rows={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste CSS rules here to style the live preview box below..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <PreviewBoxShell
            title="Live CSS Preview Box"
            badge={<span className="text-xs text-slate-500 dark:text-slate-400 font-normal">Text, Buttons & Card</span>}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <iframe
              title="CSS Live Preview"
              sandbox=""
              srcDoc={buildCssPreviewDocument(code)}
              className={`w-full bg-white border-0 ${isFullscreen ? 'flex-1 h-full' : 'h-72'}`}
            />
          </PreviewBoxShell>
        </div>
      )}

      {/* 3. JAVASCRIPT RUNNER */}
      {kind === 'javascript' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              JavaScript Code
            </label>
            <textarea
              id="dev-code-editor"
              rows={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write or paste JavaScript here and click Run JavaScript..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRunJavaScript}
              data-testid="run-js-button"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>Run JavaScript</span>
            </button>
            {runnerDurationMs !== null && (
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Executed in {runnerDurationMs} ms
              </span>
            )}
          </div>

          <PreviewBoxShell
            title="Console Output Preview"
            extraActions={
              consoleLogs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="px-2.5 py-0.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Clear Console
                </button>
              ) : null
            }
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <div
              data-testid="js-console-output"
              className={`bg-slate-950 text-slate-100 p-4 font-mono text-xs sm:text-sm space-y-1.5 overflow-y-auto ${
                isFullscreen ? 'flex-1 h-full' : 'min-h-[140px] max-h-72'
              }`}
            >
              {consoleLogs.length === 0 ? (
                <div className="text-slate-400">Click "Run JavaScript" to execute your script and view console output.</div>
              ) : (
                consoleLogs.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`whitespace-pre-wrap break-words ${
                      entry.level === 'error'
                        ? 'text-red-400'
                        : entry.level === 'warn'
                          ? 'text-amber-300'
                          : entry.level === 'return'
                            ? 'text-sky-300'
                            : 'text-emerald-300'
                    }`}
                  >
                    <span className="text-slate-500 mr-2 select-none">[{entry.level}]</span>
                    {entry.text}
                  </div>
                ))
              )}
            </div>
          </PreviewBoxShell>
        </div>
      )}

      {/* 4. PYTHON RUNNER */}
      {kind === 'python' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Python Source Code
            </label>
            <textarea
              id="dev-code-editor"
              rows={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write or paste Python code here and click Run Python..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRunPython}
              disabled={pythonRunning}
              data-testid="run-python-button"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] disabled:opacity-60 text-white text-sm font-semibold rounded-full shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>{pythonRunning ? 'Running Python...' : 'Run Python'}</span>
            </button>
            {pythonEngineLabel && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {pythonEngineLabel}
                {runnerDurationMs !== null ? ` · ${runnerDurationMs} ms` : ''}
              </span>
            )}
          </div>

          <PreviewBoxShell
            title="Python Output Preview"
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <pre
              data-testid="python-output"
              className={`bg-slate-950 p-4 font-mono text-xs sm:text-sm text-emerald-300 overflow-y-auto whitespace-pre-wrap ${
                isFullscreen ? 'flex-1 h-full' : 'min-h-[140px] max-h-72'
              }`}
            >
              {pythonOutput || 'Click "Run Python" to run your code directly in the browser.'}
            </pre>
          </PreviewBoxShell>
        </div>
      )}

      {/* 5. JSON VIEWER */}
      {kind === 'json-tree' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              JSON Input
            </label>
            <textarea
              id="dev-code-editor"
              rows={13}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste JSON here to inspect its tree and validate syntax..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <PreviewBoxShell
            title="Pretty Tree Preview"
            badge={
              parsedJson?.valid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Valid JSON ({parsedJson.summary})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold">
                  <AlertCircle className="w-3 h-3" /> Invalid JSON
                </span>
              )
            }
            extraActions={
              parsedJson?.valid ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTreeDefaultExpanded(true);
                      setTreeExpandVersion((v) => v + 1);
                    }}
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Expand
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTreeDefaultExpanded(false);
                      setTreeExpandVersion((v) => v + 1);
                    }}
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Collapse
                  </button>
                </div>
              ) : null
            }
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <div className={`p-4 flex-1 overflow-auto ${isFullscreen ? '' : 'max-h-[340px]'}`}>
              {parsedJson?.valid ? (
                <JsonTreeNode
                  value={parsedJson.data}
                  depth={0}
                  expandVersion={treeExpandVersion}
                  defaultExpanded={treeDefaultExpanded}
                />
              ) : (
                <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono">
                  {parsedJson?.error}
                </div>
              )}
            </div>
          </PreviewBoxShell>
        </div>
      )}

      {/* 6. MARKDOWN PREVIEW */}
      {kind === 'markdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Markdown Editor (Left)
            </label>
            <textarea
              id="dev-code-editor"
              rows={15}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write or paste Markdown text here..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <PreviewBoxShell
            title="Live Rendered Preview"
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <div
              data-testid="markdown-rendered-preview"
              className={`p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-y-auto text-sm flex-1 [&_a]:text-[#4F46E5] dark:[&_a]:text-indigo-400 [&_pre]:bg-slate-950 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-xl [&_code]:font-mono ${
                isFullscreen ? 'max-w-4xl mx-auto w-full py-8' : 'min-h-[340px] max-h-[400px]'
              }`}
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          </PreviewBoxShell>
        </div>
      )}

      {/* 7. XML VIEWER */}
      {kind === 'xml-tree' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              XML Input
            </label>
            <textarea
              id="dev-code-editor"
              rows={13}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste XML markup here to view the tree..."
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <PreviewBoxShell
            title="XML Tree Preview"
            badge={
              parsedXml?.valid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Well-formed XML
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold">
                  <AlertCircle className="w-3 h-3" /> Parse Error
                </span>
              )
            }
            extraActions={
              parsedXml?.valid ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTreeDefaultExpanded(true);
                      setTreeExpandVersion((v) => v + 1);
                    }}
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Expand
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTreeDefaultExpanded(false);
                      setTreeExpandVersion((v) => v + 1);
                    }}
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Collapse
                  </button>
                </div>
              ) : null
            }
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <div className={`p-4 flex-1 overflow-auto ${isFullscreen ? '' : 'max-h-[340px]'}`}>
              {parsedXml?.valid && parsedXml.rootNode ? (
                <XmlTreeNodeView
                  node={parsedXml.rootNode}
                  expandVersion={treeExpandVersion}
                  defaultExpanded={treeDefaultExpanded}
                />
              ) : (
                <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono">
                  {parsedXml?.valid === false ? parsedXml.error : 'Empty XML document.'}
                </div>
              )}
            </div>
          </PreviewBoxShell>
        </div>
      )}

      {/* 8. SQL FORMATTER & PREVIEW */}
      {kind === 'sql' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 p-3.5 bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Keyword Case:</span>
              <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setSqlUppercase(true)}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    sqlUppercase
                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  UPPERCASE
                </button>
                <button
                  type="button"
                  onClick={() => setSqlUppercase(false)}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    !sqlUppercase
                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  lowercase
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Indent:</span>
              <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                {([2, 4] as const).map((spaces) => (
                  <button
                    key={spaces}
                    type="button"
                    onClick={() => setSqlIndent(spaces)}
                    className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                      sqlIndent === spaces
                        ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {spaces} Spaces
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                SQL Input
              </label>
              <textarea
                id="dev-code-editor"
                rows={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste raw SQL query here..."
                className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <PreviewBoxShell
              title="Formatted SQL Preview"
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((f) => !f)}
              onExitFullscreen={() => setIsFullscreen(false)}
              onOpenNewTab={handleOpenPreviewInNewTab}
              blockedBlobUrl={blockedBlobUrl}
            >
              <pre
                data-testid="sql-formatted-preview"
                className={`flex-1 p-4 bg-slate-950 text-indigo-200 font-mono text-xs sm:text-sm overflow-auto whitespace-pre-wrap ${
                  isFullscreen ? 'h-full' : 'min-h-[260px] max-h-[340px]'
                }`}
              >
                {formattedSql || '-- Formatted SQL will appear here'}
              </pre>
            </PreviewBoxShell>
          </div>
        </div>
      )}

      {/* 9. REGEX TESTER */}
      {kind === 'regex' && regexEval && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <div className="sm:col-span-3">
              <label htmlFor="regex-pattern-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Regular Expression Pattern
              </label>
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 h-10 focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-indigo-500/10">
                <span className="font-mono text-slate-400 dark:text-slate-500 mr-1">/</span>
                <input
                  id="regex-pattern-input"
                  type="text"
                  value={regexPattern}
                  onChange={(e) => setRegexPattern(e.target.value)}
                  className="w-full text-sm font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <span className="font-mono text-slate-400 dark:text-slate-500 ml-1">/{regexFlags}</span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Flags</span>
              <div className="flex items-center gap-1.5 h-10">
                {(['g', 'i', 'm', 's'] as const).map((flag) => {
                  const active = regexFlags.includes(flag);
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => toggleRegexFlag(flag)}
                      className={`w-9 h-9 rounded-full font-mono text-xs font-bold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white border-transparent shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {flag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {regexEval.error && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono">
              {regexEval.error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Test Text
              </label>
              <textarea
                id="dev-code-editor"
                rows={11}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste test strings here..."
                className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <PreviewBoxShell
              title="Live Match Highlight Preview"
              badge={
                <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {regexEval.matches.length} {regexEval.matches.length === 1 ? 'match' : 'matches'}
                </span>
              }
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((f) => !f)}
              onExitFullscreen={() => setIsFullscreen(false)}
              onOpenNewTab={handleOpenPreviewInNewTab}
              blockedBlobUrl={blockedBlobUrl}
            >
              <div className="p-3.5 space-y-3 flex-1 overflow-y-auto">
                <div
                  data-testid="regex-highlight-preview"
                  className={`p-3 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed ${
                    isFullscreen ? '' : 'min-h-[120px] max-h-52 overflow-y-auto'
                  }`}
                >
                  {regexEval.parts.map((part, idx) =>
                    part.isMatch ? (
                      <mark
                        key={idx}
                        className="bg-indigo-100 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-600 rounded px-0.5 font-semibold"
                      >
                        {part.text}
                      </mark>
                    ) : (
                      <span key={idx}>{part.text}</span>
                    )
                  )}
                </div>

                {regexEval.matches.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50 p-3 max-h-40 overflow-y-auto space-y-1.5">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Matched Results</div>
                    {regexEval.matches.map((m) => (
                      <div
                        key={m.index}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-slate-900 dark:text-slate-100 font-semibold">
                          #{m.index}: "{m.match}"
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                          [{m.start}..{m.end}]
                          {m.groups.length > 0 ? ` · groups: [${m.groups.join(', ')}]` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PreviewBoxShell>
          </div>
        </div>
      )}

      {/* 10. TEXT DIFF */}
      {kind === 'diff' && diffResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dev-code-editor" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Original Text
              </label>
              <textarea
                id="dev-code-editor"
                rows={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste original text here..."
                className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <div>
              <label htmlFor="dev-diff-modified" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Modified Text
              </label>
              <textarea
                id="dev-diff-modified"
                rows={7}
                value={secondaryCode}
                onChange={(e) => setSecondaryCode(e.target.value)}
                placeholder="Paste modified text here..."
                className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
          </div>

          <PreviewBoxShell
            title="Live Line-by-Line Diff Preview"
            badge={
              <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                  +{diffResult.added} added
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-semibold">
                  -{diffResult.removed} removed
                </span>
              </div>
            }
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onExitFullscreen={() => setIsFullscreen(false)}
            onOpenNewTab={handleOpenPreviewInNewTab}
            blockedBlobUrl={blockedBlobUrl}
          >
            <div
              data-testid="text-diff-preview"
              className={`font-mono text-xs sm:text-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto ${
                isFullscreen ? 'flex-1 h-full' : 'max-h-72'
              }`}
            >
              {diffResult.lines.map((line, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[40px_40px_22px_1fr] px-3 py-1 ${
                    line.type === 'added'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : line.type === 'removed'
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-slate-400 dark:text-slate-500 select-none tabular-nums">{line.leftLine ?? ''}</span>
                  <span className="text-slate-400 dark:text-slate-500 select-none tabular-nums">{line.rightLine ?? ''}</span>
                  <span className="font-bold select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{line.text || ' '}</span>
                </div>
              ))}
            </div>
          </PreviewBoxShell>
        </div>
      )}
    </div>
  );
}
