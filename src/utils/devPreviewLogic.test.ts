import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStandalonePreviewHtml,
  computeLineDiff,
  evaluateRegexMatches,
  formatSqlPreview,
  renderMarkdownToHtml,
  runOfflinePythonFallback,
} from './devPreviewLogic';

test('evaluateRegexMatches finds and highlights matches accurately', () => {
  const res = evaluateRegexMatches('\\d+', 'g', 'Order 102 has 3 items');
  assert.equal(res.error, null);
  assert.equal(res.matches.length, 2);
  assert.equal(res.matches[0].match, '102');
  assert.equal(res.matches[1].match, '3');
  assert.equal(res.parts.filter((p) => p.isMatch).length, 2);
});

test('evaluateRegexMatches reports invalid regex pattern cleanly', () => {
  const res = evaluateRegexMatches('[unclosed', 'g', 'hello');
  assert.ok(res.error);
  assert.equal(res.matches.length, 0);
});

test('formatSqlPreview formats clauses and column list cleanly', () => {
  const sql = 'select id, name, email from users where active = true order by id desc;';
  const out = formatSqlPreview(sql, { uppercase: true, indentSpaces: 2 });
  assert.equal(out.includes('SELECT\n  id,\n  name,\n  email'), true);
  assert.equal(out.includes('\nFROM users'), true);
  assert.equal(out.includes('\nWHERE active = TRUE'), true);
});

test('renderMarkdownToHtml renders headings, bold, and lists safely', () => {
  const html = renderMarkdownToHtml('# Hello\n\n**Private** tools\n\n- Item A\n- Item B');
  assert.equal(html.includes('<h1'), true);
  assert.equal(html.includes('<strong'), true);
  assert.equal(html.includes('<ul'), true);
});

test('runOfflinePythonFallback evaluates print, variables, and range loop', () => {
  const output = runOfflinePythonFallback('x = 5\nfor i in range(3):\n  print(f"num={i}")\nprint(x + 2)');
  assert.equal(output, 'num=0\nnum=1\nnum=2\n7');
});

test('computeLineDiff accurately tracks added, removed, and unchanged lines', () => {
  const res = computeLineDiff('alpha\nbeta\ngamma', 'alpha\nbeta-2\ngamma\ndelta');
  assert.equal(res.unchanged, 2);
  assert.equal(res.removed, 1);
  assert.equal(res.added, 2);
});

test('buildStandalonePreviewHtml produces clean white full-screen standalone previews without editor controls', () => {
  const mdHtml = buildStandalonePreviewHtml({ kind: 'markdown', code: '# Title\n\nBody' });
  assert.equal(mdHtml.includes('background: #ffffff'), true);
  assert.equal(mdHtml.includes('<textarea'), false);
  assert.equal(mdHtml.includes('Title'), true);

  const jsonHtml = buildStandalonePreviewHtml({ kind: 'json-tree', code: '{"ok":true}' });
  assert.equal(jsonHtml.includes('Valid JSON'), true);
  assert.equal(jsonHtml.includes('<textarea'), false);

  const jsHtml = buildStandalonePreviewHtml({
    kind: 'javascript',
    code: 'console.log("hi")',
    consoleEntries: [{ level: 'log', text: 'hi' }],
    durationMs: 0.2,
  });
  assert.equal(jsHtml.includes('JavaScript Output + Console'), true);
  assert.equal(jsHtml.includes('[log]'), true);

  const diffHtml = buildStandalonePreviewHtml({
    kind: 'diff',
    code: 'old',
    diffModifiedText: 'new',
  });
  assert.equal(diffHtml.includes('+1 added'), true);
  assert.equal(diffHtml.includes('-1 removed'), true);
});
