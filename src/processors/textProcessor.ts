import type { ProcessOptions, ProcessOutputFile, ProcessResult } from './types';
import { replaceExtension } from '../utils/formatters';

export const SAMPLE_INPUTS: Record<string, string> = {
  'json-formatter': '{"brand":"NexcTool","private":true,"toolsCount":200,"features":["Zero Uploads","Browser Native","Fast"],"metrics":{"latencyMs":0,"serverCost":0}}',
  'json-validator': '{"status":"valid","items":[{"id":1,"name":"JPG to PNG"},{"id":2,"name":"Merge PDF"}]}',
  'csv-to-json': 'name,category,private\nJPG to PNG,Image Tools,true\nMerge PDF,PDF Tools,true\nJSON Formatter,Text & Developer Tools,true',
  'json-to-csv': '[{"tool":"JPG to PNG","category":"Image Tools","free":true},{"tool":"Merge PDF","category":"PDF Tools","free":true}]',
  'csv-to-tsv': 'name,type,status\nalpha,image,ready\nbeta,pdf,ready',
  'tsv-to-csv': 'name\ttype\tstatus\nalpha\timage\tready\nbeta\tpdf\tready',
  'csv-splitter': 'id,name,category\n1,JPG to PNG,Image Tools\n2,Merge PDF,PDF Tools\n3,JSON Formatter,Developer\n4,ZIP Creator,Archives\n5,SHA-256 Generator,Utilities',
  'html-formatter': '<section class="hero"><h1>NexcTool</h1><p>Your file never leaves your device.</p></section>',
  'html-minifier': '<!doctype html>\n<html>\n  <body>\n    <!-- comment -->\n    <h1>  NexcTool  </h1>\n    <p>  Private file tools  </p>\n  </body>\n</html>',
  'html-to-markdown': '<article><h1>NexcTool</h1><p><strong>100% Private</strong> file tools inside your <a href="https://nexctool.com">browser</a>.</p><ul><li>Zero uploads</li><li>Fast processing</li></ul></article>',
  'css-formatter': '.card{background:#fff;border:1px solid #e2e8f0;padding:24px}.btn{color:#fff;background:#2563eb}',
  'css-minifier': '/* Primary button */\n.btn {\n  background-color: #2563eb;\n  color: #ffffff;\n  padding: 12px 24px;\n}',
  'javascript-formatter': 'function greet(name){const msg="Hello, "+name;if(name){console.log(msg);}return msg;}',
  'javascript-minifier': '// Sample helper\nfunction greet(name) {\n  const message = "Hello " + name;\n  return message;\n}',
  'xml-formatter': '<catalog><tool id="1"><name>JPG to PNG</name><private>true</private></tool></catalog>',
  'xml-validator': '<?xml version="1.0" encoding="UTF-8"?>\n<nexctool>\n  <privacy>local-only</privacy>\n</nexctool>',
  'xml-to-json': '<toolkit><brand>NexcTool</brand><privacy>local</privacy><tool>JPG to PNG</tool><tool>Merge PDF</tool></toolkit>',
  'json-to-xml': '{"toolkit":{"brand":"NexcTool","private":true,"tools":["JPG to PNG","Merge PDF"]}}',
  'yaml-to-json': 'brand: NexcTool\nprivate: true\ntoolsCount: 209\nfeatures:\n  - Zero Uploads\n  - Browser Native',
  'json-to-yaml': '{"brand":"NexcTool","private":true,"toolsCount":209,"features":["Zero Uploads","Browser Native"]}',
  'base64-encoder-decoder': 'Your file never leaves your device.',
  'url-encoder-decoder': 'https://nexctool.com/tools/jpg-to-png?privacy=100% local',
  'sql-formatter': 'select id, name, category from tools where mode = \'browser\' and popular = true order by id asc;',
  'regex-tester': 'Contact omithvidul@gmail.com or visit https://nexctool.com/tools/json-formatter',
  'markdown-to-html': '# NexcTool\n\n**100% Private** browser tools.\n\n- Zero server uploads\n- Instant processing\n- Free forever',
  'html-to-txt': '<article><h1>NexcTool</h1><p>Convert files locally. <strong>Zero uploads.</strong></p></article>',
  'txt-to-html': 'NexcTool\nYour file never leaves your device.\nFast and private.',
  'document-word-counter': 'NexcTool gives you 200 free online file tools. Every supported operation runs right inside your browser so your file never leaves your device.',
  'document-character-counter': 'NexcTool: Your file never leaves your device.',
  'csv-cleaner': 'name, email , role \n Alice , alice@example.com , Admin \n\n Bob , bob@example.com , Editor ',
  'duplicate-row-remover': 'apple\nbanana\napple\norange\nbanana\ngrape',
  'md5-generator': 'Your file never leaves your device.',
  'csv-to-xlsx': 'Tool,Category,Privacy\nJPG to PNG,Image Tools,100% Local\nMerge PDF,PDF Tools,100% Local\nCSV to XLSX,Spreadsheet Tools,100% Local',
  'json-to-xlsx': '[{"tool":"JPG to PNG","category":"Image Tools","local":true},{"tool":"CSV to XLSX","category":"Spreadsheet Tools","local":true}]',
  'txt-to-docx': 'NexcTool Local Document\n\nThis Word document was generated cleanly inside your browser with zero server uploads.\n\nEvery paragraph stays private on your device.',
  'html-to-docx': '<article><h1>NexcTool Report</h1><p>This Word document was converted from <strong>HTML</strong> cleanly inside your browser.</p><ul><li>Zero uploads</li><li>Fast offline output</li></ul></article>',
  'markdown-to-docx': '# NexcTool Notes\n\n**100% Private** document generation.\n\n- Works offline inside your browser\n- Zero server uploads',
};

export function formatJsonText(input: string, indent: 0 | 2 | 4 = 2): string {
  const parsed = JSON.parse(input);
  return indent === 0 ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent);
}

export function parseCsvRows(csvText: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export function serializeDelimited(rows: string[][], delimiter = ','): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const str = String(cell ?? '');
          if (str.includes('"') || str.includes(delimiter) || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(delimiter)
    )
    .join('\n');
}

export function csvToJsonText(csvText: string): string {
  const rows = parseCsvRows(csvText, ',');
  if (rows.length === 0) return '[]';
  const headers = rows[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  const objects = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? '';
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

export function jsonToCsvText(jsonText: string): string {
  const parsed = JSON.parse(jsonText);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  if (arr.length === 0) return '';
  const headers = Array.from(
    new Set(arr.flatMap((item) => (item && typeof item === 'object' ? Object.keys(item) : ['value'])))
  );
  const rows: string[][] = [headers];
  for (const item of arr) {
    if (item && typeof item === 'object') {
      rows.push(
        headers.map((h) => {
          const val = (item as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '';
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        })
      );
    } else {
      rows.push([String(item ?? '')]);
    }
  }
  return serializeDelimited(rows, ',');
}

export function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function formatJavaScriptBasic(code: string): string {
  let indent = 0;
  let out = '';
  let inQuote: string | null = null;
  let parenDepth = 0;
  const src = code.trim();

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];

    if (inQuote) {
      out += ch;
      if (ch === inQuote && prev !== '\\') inQuote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inQuote = ch;
      out += ch;
      continue;
    }

    if (ch === '(') parenDepth++;
    if (ch === ')' && parenDepth > 0) parenDepth--;

    if (ch === '{') {
      out = out.trimEnd() + ' {\n' + '  '.repeat(++indent);
    } else if (ch === '}') {
      indent = Math.max(0, indent - 1);
      out = out.trimEnd() + '\n' + '  '.repeat(indent) + '}\n' + '  '.repeat(indent);
    } else if (ch === ';' && parenDepth === 0) {
      out = out.trimEnd() + ';\n' + '  '.repeat(indent);
    } else if (ch === '\n' || ch === '\r') {
      if (!out.endsWith('\n') && !out.endsWith('  ')) out += ' ';
    } else if (ch === ' ' || ch === '\t') {
      if (out.length > 0 && !/[\s\n]$/.test(out)) out += ' ';
    } else {
      out += ch;
    }
  }

  return out
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
    .join('\n')
    .trim();
}

function parseYamlScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(parseYamlScalar);
  }
  return s;
}

export function yamlToJsonText(yaml: string): string {
  const rawLines = yaml
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+#.*$/, ''))
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));

  if (rawLines.length === 0) return '{}';

  let idx = 0;
  function getIndent(line: string): number {
    return line.length - line.trimStart().length;
  }

  function parseBlock(minIndent: number): unknown {
    const firstTrim = rawLines[idx].trimStart();
    if (firstTrim.startsWith('- ')) {
      const arr: unknown[] = [];
      while (idx < rawLines.length) {
        const line = rawLines[idx];
        const indent = getIndent(line);
        const trimmed = line.trimStart();
        if (indent < minIndent || !trimmed.startsWith('- ')) break;
        const rest = trimmed.slice(2).trim();
        idx++;
        if (!rest) {
          if (idx < rawLines.length && getIndent(rawLines[idx]) > indent) {
            arr.push(parseBlock(getIndent(rawLines[idx])));
          } else {
            arr.push(null);
          }
        } else if (rest.includes(': ') || rest.endsWith(':')) {
          const obj: Record<string, unknown> = {};
          const colonIdx = rest.indexOf(':');
          const key = rest.slice(0, colonIdx).trim();
          const valPart = rest.slice(colonIdx + 1).trim();
          obj[key] = valPart ? parseYamlScalar(valPart) : null;
          if (idx < rawLines.length && getIndent(rawLines[idx]) > indent) {
            const nested = parseBlock(getIndent(rawLines[idx]));
            if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
              Object.assign(obj, nested);
            }
          }
          arr.push(obj);
        } else {
          arr.push(parseYamlScalar(rest));
        }
      }
      return arr;
    }

    const obj: Record<string, unknown> = {};
    while (idx < rawLines.length) {
      const line = rawLines[idx];
      const indent = getIndent(line);
      const trimmed = line.trimStart();
      if (indent < minIndent || trimmed.startsWith('- ')) break;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) {
        idx++;
        continue;
      }
      const key = trimmed.slice(0, colonIdx).trim();
      const valPart = trimmed.slice(colonIdx + 1).trim();
      idx++;
      if (valPart) {
        obj[key] = parseYamlScalar(valPart);
      } else if (idx < rawLines.length && getIndent(rawLines[idx]) > indent) {
        obj[key] = parseBlock(getIndent(rawLines[idx]));
      } else {
        obj[key] = null;
      }
    }
    return obj;
  }

  const result = parseBlock(getIndent(rawLines[0]));
  return JSON.stringify(result, null, 2);
}

function toYamlString(value: unknown, level = 0): string {
  const pad = '  '.repeat(level);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/[:#{}[\],&*?|<>=!%@`]/.test(value) || value === '' || /^\s|\s$/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const nested = toYamlString(item, level + 1);
          const firstLineCut = nested.indexOf('\n');
          if (firstLineCut === -1) return `${pad}- ${nested.trimStart()}`;
          return `${pad}- ${nested.trimStart()}`;
        }
        return `${pad}- ${toYamlString(item, level + 1)}`;
      })
      .join('\n');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return entries
    .map(([k, v]) => {
      if (v !== null && typeof v === 'object') {
        if (Array.isArray(v) && v.length === 0) return `${pad}${k}: []`;
        if (!Array.isArray(v) && Object.keys(v).length === 0) return `${pad}${k}: {}`;
        return `${pad}${k}:\n${toYamlString(v, level + 1)}`;
      }
      return `${pad}${k}: ${toYamlString(v, level)}`;
    })
    .join('\n');
}

export function jsonToYamlText(jsonText: string): string {
  const parsed = JSON.parse(jsonText);
  return toYamlString(parsed, 0);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function jsonToXmlText(jsonText: string): string {
  const parsed = JSON.parse(jsonText);

  function buildNode(name: string, val: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const safeName = /^[a-zA-Z_][\w:.-]*$/.test(name) ? name : 'item';
    if (Array.isArray(val)) {
      return val.map((item) => buildNode(safeName, item, depth)).join('\n');
    }
    if (val !== null && typeof val === 'object') {
      const children = Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => buildNode(k, v, depth + 1))
        .join('\n');
      return children
        ? `${pad}<${safeName}>\n${children}\n${pad}</${safeName}>`
        : `${pad}<${safeName} />`;
    }
    return `${pad}<${safeName}>${escapeXml(String(val ?? ''))}</${safeName}>`;
  }

  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    if (keys.length === 1) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n${buildNode(keys[0], (parsed as Record<string, unknown>)[keys[0]], 0)}`;
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${buildNode('root', parsed, 0)}`;
}

export function xmlToJsonText(xmlText: string): string {
  const check = validateXmlBasic(xmlText);
  if (!check.valid) throw new Error(check.error || 'Invalid XML');

  const cleaned = xmlText
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  let cursor = 0;

  function parseElement(): { tag: string; value: unknown } {
    const openMatch = /^<([a-zA-Z_][\w:.-]*)([^>]*)>/.exec(cleaned.slice(cursor));
    if (!openMatch) {
      throw new Error('Malformed XML element.');
    }
    const tag = openMatch[1];
    const attrsRaw = openMatch[2];
    const selfClosing = attrsRaw.endsWith('/');
    cursor += openMatch[0].length;

    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrsRaw)) !== null) {
      attrs[`@${attrMatch[1]}`] = attrMatch[2];
    }

    if (selfClosing) {
      return { tag, value: Object.keys(attrs).length > 0 ? attrs : '' };
    }

    const obj: Record<string, unknown> = { ...attrs };
    let textContent = '';
    let hasChildren = false;

    while (cursor < cleaned.length) {
      while (cursor < cleaned.length && /\s/.test(cleaned[cursor]) && cleaned[cursor + 1] === '<') {
        cursor++;
      }
      if (cleaned.slice(cursor).startsWith(`</${tag}>`)) {
        cursor += tag.length + 3;
        break;
      }
      if (cleaned[cursor] === '<') {
        hasChildren = true;
        const child = parseElement();
        if (child.tag in obj) {
          const existing = obj[child.tag];
          if (Array.isArray(existing)) {
            existing.push(child.value);
          } else {
            obj[child.tag] = [existing, child.value];
          }
        } else {
          obj[child.tag] = child.value;
        }
      } else {
        const nextTag = cleaned.indexOf('<', cursor);
        if (nextTag === -1) break;
        textContent += cleaned.slice(cursor, nextTag);
        cursor = nextTag;
      }
    }

    const trimmedText = textContent.trim();
    if (!hasChildren) {
      if (Object.keys(attrs).length > 0) {
        if (trimmedText) obj['#text'] = trimmedText;
        return { tag, value: obj };
      }
      if (trimmedText === 'true') return { tag, value: true };
      if (trimmedText === 'false') return { tag, value: false };
      if (/^-?\d+(\.\d+)?$/.test(trimmedText)) return { tag, value: Number(trimmedText) };
      return { tag, value: trimmedText };
    }

    return { tag, value: obj };
  }

  const root = parseElement();
  return JSON.stringify({ [root.tag]: root.value }, null, 2);
}

export function htmlToMarkdownText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<\/(p|div|article|section|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitCsvText(csvText: string, rowsPerFile = 100): string[] {
  const rows = parseCsvRows(csvText, ',');
  if (rows.length === 0) return [];
  if (rows.length === 1) return [serializeDelimited(rows, ',')];

  const header = rows[0];
  const body = rows.slice(1);
  const size = Math.max(1, Math.floor(rowsPerFile));
  const chunks: string[] = [];

  for (let i = 0; i < body.length; i += size) {
    const slice = [header, ...body.slice(i, i + size)];
    chunks.push(serializeDelimited(slice, ','));
  }
  return chunks;
}

function formatXmlString(xml: string): string {
  const cleaned = xml.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
  let pad = 0;
  return cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((node) => {
      let indent = 0;
      if (/^<\/\w/.test(node)) {
        pad = Math.max(0, pad - 1);
      } else if (/^<\w[^>]*[^/]>.*$/.test(node) && !/<\/\w[^>]*>$/.test(node) && !node.startsWith('<?')) {
        indent = 1;
      }
      const padded = '  '.repeat(pad) + node;
      pad += indent;
      return padded;
    })
    .join('\n');
}

function validateXmlBasic(xml: string): { valid: boolean; error?: string } {
  const stripped = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .trim();
  if (!stripped) return { valid: false, error: 'XML input is empty.' };
  const tagRegex = /<\/?([a-zA-Z_][\w:.-]*)([^>]*)>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  let tagCount = 0;
  while ((match = tagRegex.exec(stripped)) !== null) {
    tagCount++;
    const full = match[0];
    const name = match[1];
    if (full.startsWith('</')) {
      const top = stack.pop();
      if (top !== name) {
        return { valid: false, error: `Mismatched closing tag </${name}>${top ? ` (expected </${top}>)` : ''}.` };
      }
    } else if (!full.endsWith('/>')) {
      stack.push(name);
    }
  }
  if (tagCount === 0) return { valid: false, error: 'No XML elements found.' };
  if (stack.length > 0) return { valid: false, error: `Unclosed tag <${stack[stack.length - 1]}>.` };
  return { valid: true };
}

function markdownToSimpleHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const htmlLines: string[] = [];
  let inList = false;

  const inline = (text: string) =>
    text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      htmlLines.push(`  <li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (inList) {
      htmlLines.push('</ul>');
      inList = false;
    }
    if (line.startsWith('### ')) htmlLines.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) htmlLines.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) htmlLines.push(`<h1>${inline(line.slice(2))}</h1>`);
    else htmlLines.push(`<p>${inline(line)}</p>`);
  }
  if (inList) htmlLines.push('</ul>');
  return htmlLines.join('\n');
}

function formatSqlBasic(sql: string): string {
  const keywords = [
    'SELECT',
    'FROM',
    'WHERE',
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'JOIN',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
    'LIMIT',
    'INSERT INTO',
    'VALUES',
    'UPDATE',
    'SET',
    'DELETE FROM',
  ];
  let out = sql.trim().replace(/\s+/g, ' ');
  for (const kw of keywords) {
    const re = new RegExp(`\\b${kw}\\b`, 'gi');
    out = out.replace(re, `\n${kw}`);
  }
  return out.trim();
}

export async function processTextTool(
  slug: string,
  files: File[],
  textInput: string,
  options: ProcessOptions
): Promise<ProcessResult> {
  if (slug === 'csv-merger') {
    if (files.length < 2) {
      throw new Error('Please select at least 2 CSV files to merge.');
    }
    const texts = await Promise.all(files.map((f) => f.text()));
    let header: string[] | null = null;
    const mergedRows: string[][] = [];
    for (const t of texts) {
      const rows = parseCsvRows(t, ',');
      if (rows.length === 0) continue;
      if (!header) {
        header = rows[0];
        mergedRows.push(...rows);
      } else {
        const sameHeader = JSON.stringify(rows[0]) === JSON.stringify(header);
        mergedRows.push(...(sameHeader ? rows.slice(1) : rows));
      }
    }
    const mergedCsv = serializeDelimited(mergedRows, ',');
    const blob = new Blob([mergedCsv], { type: 'text/csv;charset=utf-8' });
    return {
      files: [{ blob, filename: 'merged.csv', mimeType: 'text/csv', size: blob.size }],
      textOutput: mergedCsv,
      outputFilename: 'merged.csv',
      outputMimeType: 'text/csv',
      summaryLines: [`Merged ${files.length} CSV files (${mergedRows.length} total rows)`],
    };
  }

  let rawText = textInput;
  const sourceFile = files[0];
  if (sourceFile && !rawText.trim()) {
    rawText = await sourceFile.text();
  }
  if (!rawText.trim() && slug !== 'base64-encoder-decoder') {
    throw new Error('Please upload a file or enter text to process.');
  }

  if (slug === 'csv-splitter') {
    const rowsPerChunk = Math.max(1, options.csvSplitRows ?? 100);
    const chunks = splitCsvText(rawText, rowsPerChunk);
    if (chunks.length === 0) {
      throw new Error('No CSV rows found to split.');
    }
    const baseName = sourceFile ? sourceFile.name : 'data.csv';
    const outFiles: ProcessOutputFile[] = chunks.map((chunk, i) => {
      const blob = new Blob([chunk], { type: 'text/csv;charset=utf-8' });
      return {
        blob,
        filename: replaceExtension(baseName, `part-${i + 1}.csv`),
        mimeType: 'text/csv',
        size: blob.size,
      };
    });
    const totalOut = outFiles.reduce((acc, f) => acc + f.size, 0);
    return {
      files: outFiles,
      textOutput: chunks[0],
      outputFilename: outFiles[0]?.filename,
      outputMimeType: 'text/csv',
      summaryLines: [`Split CSV into ${chunks.length} part(s) of up to ${rowsPerChunk} data rows each`],
      originalTotalBytes: sourceFile?.size ?? new Blob([rawText]).size,
      outputTotalBytes: totalOut,
    };
  }

  const baseName = sourceFile ? sourceFile.name : 'output.txt';
  let outputText = '';
  let outExt = 'txt';
  let outMime = 'text/plain;charset=utf-8';
  const summaryLines: string[] = [];

  switch (slug) {
    case 'json-formatter': {
      const indent = options.indent ?? 2;
      outputText = formatJsonText(rawText, indent);
      outExt = 'json';
      outMime = 'application/json;charset=utf-8';
      summaryLines.push(indent === 0 ? 'JSON minified successfully' : `JSON formatted with ${indent}-space indentation`);
      break;
    }
    case 'json-validator': {
      const parsed = JSON.parse(rawText);
      const kind = Array.isArray(parsed)
        ? `Array (${parsed.length} items)`
        : typeof parsed === 'object' && parsed !== null
          ? `Object (${Object.keys(parsed).length} keys)`
          : typeof parsed;
      outputText = JSON.stringify(parsed, null, 2);
      outExt = 'json';
      outMime = 'application/json;charset=utf-8';
      summaryLines.push(`Valid JSON · Root type: ${kind}`);
      break;
    }
    case 'csv-to-json': {
      outputText = csvToJsonText(rawText);
      outExt = 'json';
      outMime = 'application/json;charset=utf-8';
      summaryLines.push('Converted CSV to JSON array');
      break;
    }
    case 'json-to-csv': {
      outputText = jsonToCsvText(rawText);
      outExt = 'csv';
      outMime = 'text/csv;charset=utf-8';
      summaryLines.push('Converted JSON to CSV table');
      break;
    }
    case 'csv-to-tsv': {
      const rows = parseCsvRows(rawText, ',');
      outputText = serializeDelimited(rows, '\t');
      outExt = 'tsv';
      outMime = 'text/tab-separated-values;charset=utf-8';
      summaryLines.push(`Converted ${rows.length} rows from CSV to TSV`);
      break;
    }
    case 'tsv-to-csv': {
      const rows = parseCsvRows(rawText, '\t');
      outputText = serializeDelimited(rows, ',');
      outExt = 'csv';
      outMime = 'text/csv;charset=utf-8';
      summaryLines.push(`Converted ${rows.length} rows from TSV to CSV`);
      break;
    }
    case 'csv-cleaner': {
      const rows = parseCsvRows(rawText, ',').map((r) => r.map((c) => c.trim()));
      const nonEmpty = rows.filter((r) => r.some((c) => c.length > 0));
      outputText = serializeDelimited(nonEmpty, ',');
      outExt = 'csv';
      outMime = 'text/csv;charset=utf-8';
      summaryLines.push(`Cleaned whitespace & blank rows (${nonEmpty.length} rows kept)`);
      break;
    }
    case 'duplicate-row-remover': {
      const lines = rawText.replace(/\r\n/g, '\n').split('\n');
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const line of lines) {
        if (!seen.has(line)) {
          seen.add(line);
          unique.push(line);
        }
      }
      outputText = unique.join('\n');
      outExt = sourceFile?.name.endsWith('.csv') ? 'csv' : 'txt';
      summaryLines.push(`Removed ${lines.length - unique.length} duplicate rows (${unique.length} unique rows kept)`);
      break;
    }
    case 'html-formatter': {
      outputText = formatXmlString(rawText);
      outExt = 'html';
      outMime = 'text/html;charset=utf-8';
      summaryLines.push('Formatted HTML markup');
      break;
    }
    case 'html-minifier': {
      outputText = rawText
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
      outExt = 'html';
      outMime = 'text/html;charset=utf-8';
      summaryLines.push(`Minified HTML (${rawText.length} -> ${outputText.length} chars)`);
      break;
    }
    case 'html-to-markdown': {
      outputText = htmlToMarkdownText(rawText);
      outExt = 'md';
      outMime = 'text/markdown;charset=utf-8';
      summaryLines.push('Converted HTML to clean Markdown');
      break;
    }
    case 'css-formatter': {
      outputText = rawText
        .replace(/\s*\{\s*/g, ' {\n  ')
        .replace(/;\s*/g, ';\n  ')
        .replace(/\s*\}\s*/g, '\n}\n\n')
        .replace(/\n  \n}/g, '\n}')
        .trim();
      outExt = 'css';
      outMime = 'text/css;charset=utf-8';
      summaryLines.push('Formatted CSS stylesheet');
      break;
    }
    case 'css-minifier': {
      outputText = rawText
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();
      outExt = 'css';
      outMime = 'text/css;charset=utf-8';
      summaryLines.push(`Minified CSS (${rawText.length} -> ${outputText.length} chars)`);
      break;
    }
    case 'javascript-formatter': {
      outputText = formatJavaScriptBasic(rawText);
      outExt = 'js';
      outMime = 'application/javascript;charset=utf-8';
      summaryLines.push('Formatted JavaScript code');
      break;
    }
    case 'javascript-minifier': {
      outputText = rawText
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}();,=+\-*/<>])\s*/g, '$1')
        .trim();
      outExt = 'js';
      outMime = 'application/javascript;charset=utf-8';
      summaryLines.push(`Minified JS (${rawText.length} -> ${outputText.length} chars)`);
      break;
    }
    case 'xml-formatter': {
      const check = validateXmlBasic(rawText);
      if (!check.valid) throw new Error(check.error || 'Invalid XML');
      outputText = formatXmlString(rawText);
      outExt = 'xml';
      outMime = 'application/xml;charset=utf-8';
      summaryLines.push('Formatted valid XML document');
      break;
    }
    case 'xml-validator': {
      const check = validateXmlBasic(rawText);
      if (!check.valid) throw new Error(check.error || 'Invalid XML');
      outputText = formatXmlString(rawText);
      outExt = 'xml';
      outMime = 'application/xml;charset=utf-8';
      summaryLines.push('Valid XML structure verified');
      break;
    }
    case 'xml-to-json': {
      outputText = xmlToJsonText(rawText);
      outExt = 'json';
      outMime = 'application/json;charset=utf-8';
      summaryLines.push('Converted XML to structured JSON');
      break;
    }
    case 'json-to-xml': {
      outputText = jsonToXmlText(rawText);
      outExt = 'xml';
      outMime = 'application/xml;charset=utf-8';
      summaryLines.push('Converted JSON to XML document');
      break;
    }
    case 'yaml-to-json': {
      outputText = yamlToJsonText(rawText);
      outExt = 'json';
      outMime = 'application/json;charset=utf-8';
      summaryLines.push('Converted YAML to JSON');
      break;
    }
    case 'json-to-yaml': {
      outputText = jsonToYamlText(rawText);
      outExt = 'yaml';
      outMime = 'text/yaml;charset=utf-8';
      summaryLines.push('Converted JSON to YAML');
      break;
    }
    case 'base64-encoder-decoder': {
      const mode = options.textMode ?? 'encode';
      if (mode === 'encode') {
        if (sourceFile && !textInput.trim()) {
          const buf = await sourceFile.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          outputText = btoa(binary);
        } else {
          outputText = encodeBase64Utf8(rawText);
        }
        summaryLines.push('Encoded to Base64');
      } else {
        outputText = decodeBase64Utf8(rawText);
        summaryLines.push('Decoded from Base64');
      }
      outExt = 'txt';
      break;
    }
    case 'url-encoder-decoder': {
      const mode = options.textMode ?? 'encode';
      outputText = mode === 'encode' ? encodeURIComponent(rawText) : decodeURIComponent(rawText);
      summaryLines.push(mode === 'encode' ? 'URL encoded' : 'URL decoded');
      outExt = 'txt';
      break;
    }
    case 'sql-formatter': {
      outputText = formatSqlBasic(rawText);
      outExt = 'sql';
      summaryLines.push('Formatted SQL query');
      break;
    }
    case 'regex-tester': {
      const pattern = options.regexPattern ?? '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}';
      const flags = options.regexFlags ?? 'g';
      const regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
      const matches = Array.from(rawText.matchAll(regex)).map((m, idx) => `${idx + 1}. "${m[0]}" (index ${m.index ?? 0})`);
      outputText = matches.length > 0 ? matches.join('\n') : 'No matches found.';
      summaryLines.push(`Pattern /${pattern}/${flags} found ${matches.length} match(es)`);
      outExt = 'txt';
      break;
    }
    case 'markdown-to-html': {
      outputText = markdownToSimpleHtml(rawText);
      outExt = 'html';
      outMime = 'text/html;charset=utf-8';
      summaryLines.push('Converted Markdown to HTML');
      break;
    }
    case 'txt-to-html': {
      const escaped = rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      outputText = escaped
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, '<br />\n')}</p>`)
        .join('\n');
      outExt = 'html';
      outMime = 'text/html;charset=utf-8';
      summaryLines.push('Converted plain text to HTML paragraphs');
      break;
    }
    case 'html-to-txt': {
      outputText = rawText
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      outExt = 'txt';
      summaryLines.push('Extracted plain text from HTML');
      break;
    }
    case 'document-word-counter':
    case 'document-character-counter': {
      const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
      const chars = rawText.length;
      const charsNoSpaces = rawText.replace(/\s/g, '').length;
      const lines = rawText.split(/\r?\n/).length;
      const readMin = Math.max(1, Math.ceil(words / 200));
      outputText = [
        `Words: ${words}`,
        `Characters (with spaces): ${chars}`,
        `Characters (without spaces): ${charsNoSpaces}`,
        `Lines: ${lines}`,
        `Estimated reading time: ${readMin} min`,
      ].join('\n');
      summaryLines.push(`${words} words · ${chars} characters · ${lines} lines`);
      outExt = 'txt';
      break;
    }
    default:
      throw new Error(`Text tool "${slug}" is not configured for local processing.`);
  }

  const filename = replaceExtension(baseName, outExt);
  const blob = new Blob([outputText], { type: outMime });
  return {
    files: [{ blob, filename, mimeType: outMime, size: blob.size }],
    textOutput: outputText,
    outputFilename: filename,
    outputMimeType: outMime,
    summaryLines,
    originalTotalBytes: sourceFile?.size ?? new Blob([rawText]).size,
    outputTotalBytes: blob.size,
  };
}
