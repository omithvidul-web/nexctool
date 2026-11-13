import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatJsonText,
  csvToJsonText,
  jsonToCsvText,
  encodeBase64Utf8,
  decodeBase64Utf8,
  formatJavaScriptBasic,
  yamlToJsonText,
  jsonToYamlText,
  xmlToJsonText,
  jsonToXmlText,
  htmlToMarkdownText,
  splitCsvText,
  processTextTool,
} from './textProcessor';
import { formatBytes, calculateSavingsPercent, replaceExtension } from '../utils/formatters';

test('formatJsonText formats and minifies JSON accurately', () => {
  const formatted = formatJsonText('{"a":1,"b":[2,3]}', 2);
  assert.equal(formatted, '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  const minified = formatJsonText(formatted, 0);
  assert.equal(minified, '{"a":1,"b":[2,3]}');
});

test('csvToJsonText and jsonToCsvText roundtrip cleanly', () => {
  const csv = 'name,count\nNexcTool,200\nPrivate,100';
  const json = csvToJsonText(csv);
  const parsed = JSON.parse(json);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'NexcTool');
  const backToCsv = jsonToCsvText(json);
  assert.equal(backToCsv.includes('NexcTool,200'), true);
});

test('base64 UTF-8 encode and decode roundtrip', () => {
  const text = 'Your file never leaves your device — 100% private.';
  const encoded = encodeBase64Utf8(text);
  assert.equal(decodeBase64Utf8(encoded), text);
});

test('YAML to JSON and JSON to YAML convert structured objects and arrays', () => {
  const yaml = 'brand: NexcTool\nprivate: true\ncount: 209\nfeatures:\n  - Fast\n  - Local';
  const json = JSON.parse(yamlToJsonText(yaml));
  assert.equal(json.brand, 'NexcTool');
  assert.equal(json.private, true);
  assert.equal(json.count, 209);
  assert.deepEqual(json.features, ['Fast', 'Local']);

  const backYaml = jsonToYamlText(JSON.stringify(json));
  assert.equal(backYaml.includes('brand: NexcTool'), true);
  assert.equal(backYaml.includes('- Fast'), true);
});

test('XML to JSON and JSON to XML roundtrip elements cleanly', () => {
  const xml = '<toolkit><brand>NexcTool</brand><count>209</count></toolkit>';
  const jsonObj = JSON.parse(xmlToJsonText(xml));
  assert.equal(jsonObj.toolkit.brand, 'NexcTool');
  assert.equal(jsonObj.toolkit.count, 209);

  const backXml = jsonToXmlText(JSON.stringify(jsonObj));
  assert.equal(backXml.includes('<brand>NexcTool</brand>'), true);
});

test('htmlToMarkdownText and formatJavaScriptBasic and splitCsvText work cleanly', () => {
  const md = htmlToMarkdownText('<h1>Hello</h1><p><strong>Bold</strong> link <a href="https://a.test">site</a></p>');
  assert.equal(md.includes('# Hello'), true);
  assert.equal(md.includes('**Bold**'), true);
  assert.equal(md.includes('[site](https://a.test)'), true);

  const js = formatJavaScriptBasic('function hi(){const a=1;return a;}');
  assert.equal(js.includes('function hi() {\n  const a=1;\n  return a;\n}'), true);

  const csvParts = splitCsvText('id,name\n1,A\n2,B\n3,C', 2);
  assert.equal(csvParts.length, 2);
  assert.equal(csvParts[0], 'id,name\n1,A\n2,B');
  assert.equal(csvParts[1], 'id,name\n3,C');
});

test('processTextTool handles json-formatter end-to-end', async () => {
  const result = await processTextTool('json-formatter', [], '{"ok":true}', { indent: 2 });
  assert.equal(result.textOutput, '{\n  "ok": true\n}');
  assert.equal(result.outputFilename, 'output.json');
});

test('formatter utilities compute readable bytes, savings, and extensions', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.50 KB');
  assert.equal(calculateSavingsPercent(1000, 400), 60);
  assert.equal(replaceExtension('photo.jpeg', 'png'), 'photo.png');
});
