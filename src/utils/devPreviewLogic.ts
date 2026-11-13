export interface RegexMatchPart {
  text: string;
  isMatch: boolean;
  matchIndex?: number;
}

export interface RegexMatchDetail {
  index: number;
  match: string;
  start: number;
  end: number;
  groups: string[];
}

export function evaluateRegexMatches(
  pattern: string,
  flags: string,
  testText: string
): {
  parts: RegexMatchPart[];
  matches: RegexMatchDetail[];
  error: string | null;
} {
  if (!pattern) {
    return {
      parts: [{ text: testText, isMatch: false }],
      matches: [],
      error: null,
    };
  }
  try {
    const normalizedFlags = flags.includes('g') ? flags : `${flags}g`;
    const regex = new RegExp(pattern, normalizedFlags);
    const parts: RegexMatchPart[] = [];
    const matches: RegexMatchDetail[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let guard = 0;

    while ((m = regex.exec(testText)) !== null && guard < 1000) {
      guard++;
      const start = m.index;
      const value = m[0];
      const end = start + value.length;

      if (start > lastIndex) {
        parts.push({ text: testText.slice(lastIndex, start), isMatch: false });
      }
      if (value.length > 0) {
        parts.push({ text: value, isMatch: true, matchIndex: matches.length });
      } else {
        // Zero-length match safeguard
        regex.lastIndex = start + 1;
      }

      matches.push({
        index: matches.length + 1,
        match: value,
        start,
        end,
        groups: m.slice(1).map((g) => g ?? ''),
      });
      lastIndex = end;
    }

    if (lastIndex < testText.length) {
      parts.push({ text: testText.slice(lastIndex), isMatch: false });
    }
    if (parts.length === 0) {
      parts.push({ text: testText, isMatch: false });
    }

    return { parts, matches, error: null };
  } catch (err) {
    return {
      parts: [{ text: testText, isMatch: false }],
      matches: [],
      error: err instanceof Error ? err.message : 'Invalid regular expression.',
    };
  }
}

export function formatSqlPreview(
  sql: string,
  options: { uppercase?: boolean; indentSpaces?: number } = {}
): string {
  const uppercase = options.uppercase ?? true;
  const indent = ' '.repeat(options.indentSpaces ?? 2);
  if (!sql.trim()) return '';

  const majorClauses = [
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'DELETE FROM',
    'CREATE TABLE',
    'INSERT INTO',
    'UNION ALL',
    'GROUP BY',
    'ORDER BY',
    'SELECT',
    'VALUES',
    'UPDATE',
    'HAVING',
    'OFFSET',
    'WHERE',
    'UNION',
    'LIMIT',
    'FROM',
    'JOIN',
    'SET',
    'ON',
  ];

  const inlineKeywords = [
    'AND',
    'OR',
    'AS',
    'ASC',
    'DESC',
    'DISTINCT',
    'IN',
    'NOT',
    'NULL',
    'TRUE',
    'FALSE',
    'IS',
    'LIKE',
    'BETWEEN',
    'CASE',
    'WHEN',
    'THEN',
    'ELSE',
    'END',
    'COUNT',
    'SUM',
    'AVG',
    'MIN',
    'MAX',
  ];

  let normalized = sql.trim().replace(/\s+/g, ' ');

  const majorClauseRegex = new RegExp(`\\b(${majorClauses.join('|')})\\b`, 'gi');
  normalized = normalized.replace(majorClauseRegex, (match) => `\n${uppercase ? match.toUpperCase() : match.toLowerCase()}`);

  const inlineKeywordRegex = new RegExp(`\\b(${inlineKeywords.join('|')})\\b`, 'gi');
  normalized = normalized.replace(inlineKeywordRegex, (match) => (uppercase ? match.toUpperCase() : match.toLowerCase()));

  // Indent columns in SELECT list and sub-conditions AND/OR
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const formatted: string[] = [];
  for (const line of lines) {
    const upperStart = line.toUpperCase();
    if (upperStart.startsWith('SELECT ')) {
      const rest = line.slice(7);
      const cols = rest.split(',').map((c) => c.trim()).filter(Boolean);
      if (cols.length > 1) {
        formatted.push(uppercase ? 'SELECT' : 'select');
        cols.forEach((col, i) => {
          formatted.push(`${indent}${col}${i < cols.length - 1 ? ',' : ''}`);
        });
        continue;
      }
    }
    if (upperStart.startsWith('ON ')) {
      formatted.push(`${indent}${line}`);
      continue;
    }
    formatted.push(line);
  }

  return formatted.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;
  let inOrdered = false;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const renderInline = (text: string): string => {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-[0.9em]">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#2563EB] underline">$1</a>');
  };

  const closeLists = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    if (inOrdered) {
      out.push('</ol>');
      inOrdered = false;
    }
  };

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith('```')) {
      closeLists();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        out.push(
          `<pre class="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto my-3"><code>${escapeHtml(
            codeLines.join('\n')
          )}</code></pre>`
        );
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    const line = rawLine.trim();
    if (!line) {
      closeLists();
      continue;
    }

    if (line === '---' || line === '***') {
      closeLists();
      out.push('<hr class="my-4 border-slate-200" />');
      continue;
    }

    if (line.startsWith('> ')) {
      closeLists();
      out.push(
        `<blockquote class="pl-4 py-1 my-3 border-l-4 border-blue-300 bg-blue-50/40 text-slate-700 italic">${renderInline(
          line.slice(2)
        )}</blockquote>`
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOrdered) {
        out.push('</ol>');
        inOrdered = false;
      }
      if (!inList) {
        out.push('<ul class="list-disc pl-6 my-2 space-y-1 text-slate-700">');
        inList = true;
      }
      out.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (!inOrdered) {
        out.push('<ol class="list-decimal pl-6 my-2 space-y-1 text-slate-700">');
        inOrdered = true;
      }
      out.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    closeLists();
    if (line.startsWith('### ')) {
      out.push(`<h3 class="text-lg font-bold text-slate-900 mt-4 mb-1.5">${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      out.push(`<h2 class="text-xl font-bold text-slate-900 mt-5 mb-2">${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      out.push(`<h1 class="text-2xl font-extrabold text-slate-900 mt-2 mb-3">${renderInline(line.slice(2))}</h1>`);
    } else {
      out.push(`<p class="text-slate-700 leading-relaxed my-2">${renderInline(line)}</p>`);
    }
  }

  closeLists();
  return out.join('\n');
}

export function runOfflinePythonFallback(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const vars: Record<string, unknown> = {};
  const output: string[] = [];

  const evalExpr = (expr: string): unknown => {
    const trimmed = expr.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    if ((trimmed.startsWith('f"') && trimmed.endsWith('"')) || (trimmed.startsWith("f'") && trimmed.endsWith("'"))) {
      const inner = trimmed.slice(2, -1);
      return inner.replace(/\{([^}]+)\}/g, (_, k) => String(evalExpr(k)));
    }
    if (trimmed === 'True') return true;
    if (trimmed === 'False') return false;
    if (trimmed === 'None') return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed in vars) return vars[trimmed];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const body = trimmed.slice(1, -1).trim();
      if (!body) return [];
      return body.split(',').map((item) => evalExpr(item));
    }

    const fnMatch = /^([a-zA-Z_]\w*)\((.*)\)$/.exec(trimmed);
    if (fnMatch) {
      const [, fnName, argRaw] = fnMatch;
      const argVal = evalExpr(argRaw);
      if (fnName === 'len' && (typeof argVal === 'string' || Array.isArray(argVal))) return argVal.length;
      if (fnName === 'sum' && Array.isArray(argVal)) {
        return argVal.reduce((a: number, b) => a + Number(b), 0);
      }
      if (fnName === 'str') return String(argVal);
      if (fnName === 'int') return parseInt(String(argVal), 10);
      if (fnName === 'float') return parseFloat(String(argVal));
    }

    // Simple binary arithmetic / string concat
    const mathMatch = /^(.+?)\s*([+\-*/])\s*(.+)$/.exec(trimmed);
    if (mathMatch) {
      const left = evalExpr(mathMatch[1]);
      const op = mathMatch[2];
      const right = evalExpr(mathMatch[3]);
      if (op === '+') {
        return typeof left === 'string' || typeof right === 'string'
          ? `${String(left)}${String(right)}`
          : Number(left) + Number(right);
      }
      if (op === '-') return Number(left) - Number(right);
      if (op === '*') return Number(left) * Number(right);
      if (op === '/') return Number(left) / Number(right);
    }

    return trimmed;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    // Simple for-loop over range(n)
    const forMatch = /^for\s+([a-zA-Z_]\w*)\s+in\s+range\((\d+)(?:\s*,\s*(\d+))?\):$/.exec(line);
    if (forMatch) {
      const varName = forMatch[1];
      const start = forMatch[3] ? Number(forMatch[2]) : 0;
      const end = forMatch[3] ? Number(forMatch[3]) : Number(forMatch[2]);
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].startsWith('  ') || lines[j].startsWith('\t') || !lines[j].trim())) {
        if (lines[j].trim()) bodyLines.push(lines[j].trim());
        j++;
      }
      for (let v = start; v < end; v++) {
        vars[varName] = v;
        for (const bLine of bodyLines) {
          const printInner = /^print\((.*)\)$/.exec(bLine);
          if (printInner) {
            output.push(String(evalExpr(printInner[1])));
          }
        }
      }
      i = j - 1;
      continue;
    }

    const printMatch = /^print\((.*)\)$/.exec(line);
    if (printMatch) {
      const argsRaw = printMatch[1].split(',').map((a) => String(evalExpr(a)));
      output.push(argsRaw.join(' '));
      continue;
    }

    const assignMatch = /^([a-zA-Z_]\w*)\s*=\s*(.+)$/.exec(line);
    if (assignMatch) {
      vars[assignMatch[1]] = evalExpr(assignMatch[2]);
    }
  }

  return output.join('\n') || '(No output printed)';
}

export interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  leftLine?: number;
  rightLine?: number;
  text: string;
}

export function computeLineDiff(
  leftText: string,
  rightText: string
): {
  lines: DiffLine[];
  added: number;
  removed: number;
  unchanged: number;
} {
  const a = leftText.replace(/\r\n/g, '\n').split('\n');
  const b = rightText.replace(/\r\n/g, '\n').split('\n');

  // Guard huge inputs against O(N*M) memory blowup
  if (a.length * b.length > 400_000) {
    const lines: DiffLine[] = [];
    const maxLen = Math.max(a.length, b.length);
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    for (let i = 0; i < maxLen; i++) {
      if (i < a.length && i < b.length && a[i] === b[i]) {
        lines.push({ type: 'equal', leftLine: i + 1, rightLine: i + 1, text: a[i] });
        unchanged++;
      } else {
        if (i < a.length) {
          lines.push({ type: 'removed', leftLine: i + 1, text: a[i] });
          removed++;
        }
        if (i < b.length) {
          lines.push({ type: 'added', rightLine: i + 1, text: b[i] });
          added++;
        }
      }
    }
    return { lines, added, removed, unchanged };
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push({ type: 'equal', leftLine: i + 1, rightLine: j + 1, text: a[i] });
      unchanged++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'removed', leftLine: i + 1, text: a[i] });
      removed++;
      i++;
    } else {
      lines.push({ type: 'added', rightLine: j + 1, text: b[j] });
      added++;
      j++;
    }
  }
  while (i < m) {
    lines.push({ type: 'removed', leftLine: i + 1, text: a[i] });
    removed++;
    i++;
  }
  while (j < n) {
    lines.push({ type: 'added', rightLine: j + 1, text: b[j] });
    added++;
    j++;
  }

  return { lines, added, removed, unchanged };
}

export function buildCssPreviewDocument(css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CSS Live Preview - NexcTool</title>
<style>${css}</style>
</head>
<body>
  <div class="card">
    <h1>Sample Styled Heading</h1>
    <p>This live preview box contains a card, heading, paragraph text, and action buttons so your CSS rules apply immediately.</p>
    <div>
      <button type="button" class="btn-primary btn button">Primary Button</button>
      <button type="button" class="btn-secondary button">Secondary Button</button>
    </div>
  </div>
</body>
</html>`;
}

function renderJsonNodeToHtml(value: unknown, label?: string): string {
  const keyHtml =
    label !== undefined ? `<span class="json-key">${escapeHtml(label)}</span>: ` : '';

  if (value === null) {
    return `<div class="json-leaf">${keyHtml}<span class="json-null">null</span></div>`;
  }
  if (typeof value === 'string') {
    return `<div class="json-leaf">${keyHtml}<span class="json-str">"${escapeHtml(value)}"</span></div>`;
  }
  if (typeof value === 'number') {
    return `<div class="json-leaf">${keyHtml}<span class="json-num">${String(value)}</span></div>`;
  }
  if (typeof value === 'boolean') {
    return `<div class="json-leaf">${keyHtml}<span class="json-bool">${String(value)}</span></div>`;
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';

  if (entries.length === 0) {
    return `<div class="json-leaf">${keyHtml}<span class="json-bracket">${open}${close}</span></div>`;
  }

  const childrenHtml = entries.map(([k, v]) => renderJsonNodeToHtml(v, k)).join('');
  return `<details open class="json-node">
    <summary>${keyHtml}<span class="json-bracket">${open}</span> <span class="json-meta">${entries.length} ${isArray ? 'items' : 'keys'}</span></summary>
    <div class="json-children">${childrenHtml}</div>
    <div class="json-bracket">${close}</div>
  </details>`;
}

export interface StandalonePreviewPayload {
  kind:
    | 'html'
    | 'css'
    | 'javascript'
    | 'python'
    | 'json-tree'
    | 'markdown'
    | 'xml-tree'
    | 'sql'
    | 'regex'
    | 'diff';
  code: string;
  consoleEntries?: { level: string; text: string }[];
  pythonOutput?: string;
  pythonEngineLabel?: string;
  durationMs?: number | null;
  sqlUppercase?: boolean;
  sqlIndent?: number;
  regexPattern?: string;
  regexFlags?: string;
  diffModifiedText?: string;
  xmlMarkupBody?: string;
}

function wrapStandaloneWhitePage(title: string, extraCss: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - NexcTool Preview</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 28px 24px 48px;
    }
    .header-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 14px;
      margin-bottom: 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .header-meta h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .badge.ok { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .badge.err { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .error-box {
      padding: 14px 16px;
      border-radius: 10px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    ${extraCss}
  </style>
</head>
<body>
  <main>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

export function buildStandalonePreviewHtml(payload: StandalonePreviewPayload): string {
  const { kind, code } = payload;

  if (kind === 'html') {
    const trimmed = code.trim();
    if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      return code;
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HTML Preview - NexcTool</title>
  <style>body { margin: 0; padding: 24px; background: #ffffff; color: #0f172a; font-family: system-ui, -apple-system, sans-serif; }</style>
</head>
<body>${code}</body>
</html>`;
  }

  if (kind === 'css') {
    return buildCssPreviewDocument(code);
  }

  if (kind === 'javascript') {
    const logs = payload.consoleEntries ?? [];
    const itemsHtml =
      logs.length === 0
        ? '<div class="console-empty">No console output captured.</div>'
        : logs
            .map(
              (entry) =>
                `<div class="console-line level-${escapeHtml(entry.level)}"><span class="lvl">[${escapeHtml(
                  entry.level
                )}]</span><span>${escapeHtml(entry.text)}</span></div>`
            )
            .join('');

    return wrapStandaloneWhitePage(
      'JavaScript Console Output',
      `
      .console-panel {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 12px;
        padding: 18px 20px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13.5px;
        line-height: 1.65;
        border: 1px solid #1e293b;
      }
      .console-line { white-space: pre-wrap; word-break: break-word; padding: 2px 0; }
      .lvl { color: #64748b; margin-right: 8px; }
      .level-log { color: #6ee7b7; }
      .level-info { color: #6ee7b7; }
      .level-warn { color: #fcd34d; }
      .level-error { color: #f87171; }
      .level-return { color: #7dd3fc; }
      .console-empty { color: #94a3b8; }
      `,
      `<div class="header-meta">
        <h1>JavaScript Output + Console</h1>
        <span class="badge">${
          payload.durationMs !== null && payload.durationMs !== undefined
            ? `Executed in ${payload.durationMs} ms`
            : 'Client-Side Console'
        }</span>
      </div>
      <div class="console-panel">${itemsHtml}</div>`
    );
  }

  if (kind === 'python') {
    const out = payload.pythonOutput || runOfflinePythonFallback(code);
    return wrapStandaloneWhitePage(
      'Python Output & Console',
      `
      pre.py-out {
        margin: 0;
        background: #0f172a;
        color: #6ee7b7;
        border-radius: 12px;
        padding: 18px 20px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13.5px;
        line-height: 1.65;
        white-space: pre-wrap;
        word-break: break-word;
      }
      `,
      `<div class="header-meta">
        <h1>Python Output + Console</h1>
        <span class="badge">${escapeHtml(payload.pythonEngineLabel || 'Client-Side Python Runtime')}</span>
      </div>
      <pre class="py-out">${escapeHtml(out)}</pre>`
    );
  }

  if (kind === 'json-tree') {
    let body = '';
    let statusBadge = '<span class="badge err">Invalid JSON</span>';
    try {
      const data = JSON.parse(code);
      statusBadge = '<span class="badge ok">Valid JSON</span>';
      body = `<div class="json-tree">${renderJsonNodeToHtml(data)}</div>`;
    } catch (err) {
      body = `<div class="error-box">${escapeHtml(
        err instanceof Error ? err.message : 'Invalid JSON syntax.'
      )}</div>`;
    }
    return wrapStandaloneWhitePage(
      'JSON Pretty Output',
      `
      .json-tree { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13.5px; line-height: 1.7; }
      .json-node summary { cursor: pointer; list-style: none; user-select: none; }
      .json-node summary::-webkit-details-marker { display: none; }
      .json-node summary::before { content: '▾ '; color: #64748b; }
      .json-node:not([open]) > summary::before { content: '▸ '; }
      .json-children { padding-left: 20px; margin-left: 6px; border-left: 1px solid #e2e8f0; }
      .json-leaf { padding: 1px 0; word-break: break-word; }
      .json-key { font-weight: 600; color: #1e293b; }
      .json-str { color: #047857; }
      .json-num { color: #1d4ed8; }
      .json-bool { color: #7e22ce; }
      .json-null { color: #94a3b8; font-style: italic; }
      .json-bracket { color: #64748b; }
      .json-meta { color: #94a3b8; font-size: 12px; }
      `,
      `<div class="header-meta">
        <h1>JSON Pretty Output</h1>
        ${statusBadge}
      </div>
      ${body}`
    );
  }

  if (kind === 'markdown') {
    const rendered = renderMarkdownToHtml(code);
    return wrapStandaloneWhitePage(
      'Markdown Rendered Preview',
      `
      article.md-body { color: #334155; font-size: 16px; line-height: 1.7; }
      article.md-body h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin: 0 0 14px; }
      article.md-body h2 { font-size: 1.45rem; font-weight: 700; color: #0f172a; margin: 26px 0 10px; }
      article.md-body h3 { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 20px 0 8px; }
      article.md-body p { margin: 10px 0; }
      article.md-body strong { font-weight: 700; color: #0f172a; }
      article.md-body ul, article.md-body ol { padding-left: 24px; margin: 10px 0; }
      article.md-body li { margin: 4px 0; }
      article.md-body blockquote {
        margin: 14px 0; padding: 8px 16px; border-left: 4px solid #93c5fd;
        background: #eff6ff; color: #334155; font-style: italic;
      }
      article.md-body code {
        background: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 5px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em;
      }
      article.md-body pre {
        background: #0f172a; color: #f1f5f9; padding: 14px 16px; border-radius: 10px; overflow-x: auto;
      }
      article.md-body pre code { background: transparent; color: inherit; padding: 0; }
      article.md-body hr { border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0; }
      article.md-body a { color: #2563eb; text-decoration: underline; }
      `,
      `<article class="md-body">${rendered}</article>`
    );
  }

  if (kind === 'xml-tree') {
    const inner =
      payload.xmlMarkupBody ??
      `<pre class="xml-raw">${escapeHtml(code)}</pre>`;
    return wrapStandaloneWhitePage(
      'XML Pretty Output',
      `
      .xml-tree { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13.5px; line-height: 1.7; }
      .xml-node summary { cursor: pointer; list-style: none; user-select: none; }
      .xml-node summary::-webkit-details-marker { display: none; }
      .xml-node summary::before { content: '▾ '; color: #64748b; }
      .xml-node:not([open]) > summary::before { content: '▸ '; }
      .xml-children { padding-left: 20px; margin-left: 6px; border-left: 1px solid #e2e8f0; }
      .xml-tag { color: #1d4ed8; font-weight: 600; }
      .xml-attr-name { color: #b45309; }
      .xml-attr-val { color: #047857; }
      .xml-text { color: #047857; }
      .xml-comment { color: #94a3b8; font-style: italic; }
      pre.xml-raw { background: #f8fafc; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; overflow-x: auto; }
      `,
      `<div class="header-meta">
        <h1>XML Pretty Output</h1>
        <span class="badge">XML Document</span>
      </div>
      <div class="xml-tree">${inner}</div>`
    );
  }

  if (kind === 'sql') {
    const formatted = formatSqlPreview(code, {
      uppercase: payload.sqlUppercase ?? true,
      indentSpaces: payload.sqlIndent ?? 2,
    });
    return wrapStandaloneWhitePage(
      'Formatted SQL Preview',
      `
      pre.sql-out {
        margin: 0;
        background: #0f172a;
        color: #bae6fd;
        border-radius: 12px;
        padding: 20px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-x: auto;
      }
      `,
      `<div class="header-meta">
        <h1>Formatted SQL Preview</h1>
        <span class="badge">${payload.sqlUppercase === false ? 'lowercase' : 'UPPERCASE'} · ${
        payload.sqlIndent ?? 2
      } spaces</span>
      </div>
      <pre class="sql-out">${escapeHtml(formatted)}</pre>`
    );
  }

  if (kind === 'regex') {
    const evalResult = evaluateRegexMatches(
      payload.regexPattern ?? '',
      payload.regexFlags ?? 'g',
      code
    );
    const highlighted = evalResult.parts
      .map((p) =>
        p.isMatch ? `<mark>${escapeHtml(p.text)}</mark>` : escapeHtml(p.text)
      )
      .join('');
    const rows = evalResult.matches
      .map(
        (m) =>
          `<tr><td>#${m.index}</td><td><code>${escapeHtml(m.match)}</code></td><td>${m.start}..${
            m.end
          }</td><td>${m.groups.length > 0 ? escapeHtml(m.groups.join(', ')) : '—'}</td></tr>`
      )
      .join('');

    return wrapStandaloneWhitePage(
      'Regex Match Preview',
      `
      .regex-box {
        padding: 18px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #ffffff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
        line-height: 1.7;
        white-space: pre-wrap;
      }
      mark {
        background: #dbeafe;
        color: #1e3a8a;
        border: 1px solid #93c5fd;
        border-radius: 4px;
        padding: 0 3px;
        font-weight: 600;
      }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
      th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
      th { background: #f8fafc; font-weight: 700; color: #334155; }
      `,
      `<div class="header-meta">
        <h1>Regex Live Match Preview</h1>
        <span class="badge">${evalResult.matches.length} matches</span>
      </div>
      ${
        evalResult.error
          ? `<div class="error-box">${escapeHtml(evalResult.error)}</div>`
          : `<div class="regex-box">${highlighted}</div>
            ${
              evalResult.matches.length > 0
                ? `<table><thead><tr><th>#</th><th>Match</th><th>Range</th><th>Groups</th></tr></thead><tbody>${rows}</tbody></table>`
                : ''
            }`
      }`
    );
  }

  // kind === 'diff'
  const diff = computeLineDiff(code, payload.diffModifiedText ?? '');
  const diffHtml = diff.lines
    .map((line) => {
      const symbol = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      const cls = `diff-line diff-${line.type}`;
      return `<div class="${cls}"><span class="ln">${
        line.leftLine ?? ''
      }</span><span class="ln">${line.rightLine ?? ''}</span><span class="sym">${symbol}</span><span class="txt">${escapeHtml(
        line.text
      )}</span></div>`;
    })
    .join('');

  return wrapStandaloneWhitePage(
    'Text Diff Preview',
    `
    .diff-box {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: 1.65;
    }
    .diff-line { display: grid; grid-template-columns: 44px 44px 24px 1fr; padding: 2px 10px; }
    .diff-equal { background: #ffffff; color: #334155; }
    .diff-added { background: #ecfdf5; color: #065f46; }
    .diff-removed { background: #fef2f2; color: #991b1b; }
    .ln { color: #94a3b8; user-select: none; }
    .sym { font-weight: 700; user-select: none; }
    .txt { white-space: pre-wrap; word-break: break-word; }
    `,
    `<div class="header-meta">
      <h1>Text Diff Preview</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge ok">+${diff.added} added</span>
        <span class="badge err">-${diff.removed} removed</span>
        <span class="badge">${diff.unchanged} unchanged</span>
      </div>
    </div>
    <div class="diff-box">${diffHtml}</div>`
  );
}

