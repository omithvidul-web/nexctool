import JSZip from 'jszip';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function createDocxBytes(paragraphs: string[], title = 'NexcTool Document'): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`
  );

  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>NexcTool</dc:creator>
</cp:coreProperties>`
  );

  const safeParagraphs = paragraphs.length > 0 ? paragraphs : [''];
  const bodyXml = safeParagraphs
    .map(
      (p) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`
    )
    .join('\n    ');

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function extractDocxParagraphs(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) {
    throw new Error('Could not find word/document.xml inside this DOCX file.');
  }

  const paragraphs: string[] = [];
  const pMatches = docXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g);
  for (const pm of pMatches) {
    const inner = pm[1];
    const runs = Array.from(inner.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)).map((m) =>
      unescapeXml(m[1])
    );
    const line = runs.join('');
    if (line.trim().length > 0) {
      paragraphs.push(line);
    }
  }
  return paragraphs;
}

export async function createOdtBytes(paragraphs: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
</manifest:manifest>`
  );

  const bodyXml = paragraphs.map((p) => `<text:p>${escapeXml(p)}</text:p>`).join('\n      ');
  zip.file(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      ${bodyXml}
    </office:text>
  </office:body>
</office:document-content>`
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function extractOdtParagraphs(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) {
    throw new Error('Could not find content.xml inside this ODT file.');
  }
  const paragraphs: string[] = [];
  for (const m of contentXml.matchAll(/<text:(?:p|h)\b[^>]*>([\s\S]*?)<\/text:(?:p|h)>/g)) {
    const clean = unescapeXml(m[1].replace(/<[^>]+>/g, '')).trim();
    if (clean) paragraphs.push(clean);
  }
  return paragraphs;
}

export function rtfToPlainText(rtf: string): string {
  return rtf
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|\*)[\s\S]*?\}\}/g, '')
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|\*)[^{}]*\}/g, '')
    .replace(/\\par[d]?\r?\n?/g, '\n')
    .replace(/\\line\r?\n?/g, '\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function plainTextToRtf(paragraphs: string[]): string {
  const escaped = paragraphs
    .map((p) =>
      p
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
    )
    .join('\\par\n');
  return `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Helvetica;}}\n\\f0\\fs22\n${escaped}\n}`;
}

export async function createEpubBytes(title: string, chapters: { heading: string; text: string }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const safeChapters = chapters.length > 0 ? chapters : [{ heading: title, text: '' }];
  const manifestItems = safeChapters
    .map((_, i) => `<item id="chap${i + 1}" href="chap${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ');
  const spineItems = safeChapters.map((_, i) => `<itemref idref="chap${i + 1}"/>`).join('\n    ');

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">nexctool-${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
  );

  safeChapters.forEach((chap, i) => {
    const body = chap.text
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => `<p>${escapeXml(p)}</p>`)
      .join('\n    ');
    zip.file(
      `OEBPS/chap${i + 1}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${escapeXml(chap.heading)}</title></head>
  <body>
    <h1>${escapeXml(chap.heading)}</h1>
    ${body}
  </body>
</html>`
    );
  });

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function extractEpubText(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const htmlFiles = Object.values(zip.files)
    .filter((f) => !f.dir && /\.(xhtml|html|htm)$/i.test(f.name) && !f.name.endsWith('nav.xhtml'))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (htmlFiles.length === 0) {
    throw new Error('No readable XHTML chapters found inside this EPUB.');
  }
  const pages: string[] = [];
  for (const file of htmlFiles) {
    const html = await file.async('string');
    const txt = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(p|h[1-6]|li|div|br)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (txt) pages.push(txt);
  }
  return pages;
}

export interface SlideTextData {
  index: number;
  title: string;
  lines: string[];
}

export async function createPptxBytes(slides: { title: string; lines: string[] }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const safeSlides = slides.length > 0 ? slides : [{ title: 'Slide 1', lines: ['Generated by NexcTool'] }];

  const slideOverrides = safeSlides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('\n  ');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideOverrides}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  const presRels = safeSlides
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('\n  ');

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`
  );

  const sldIds = safeSlides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
    .join('\n    ');

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    ${sldIds}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`
  );

  safeSlides.forEach((slide, i) => {
    const paragraphs = [slide.title, ...slide.lines]
      .filter(Boolean)
      .map(
        (line) =>
          `<a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
      )
      .join('\n          ');

    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="609600" y="457200"/><a:ext cx="10972800" cy="5943600"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          ${paragraphs}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  });

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function extractPptxSlides(buffer: ArrayBuffer | Uint8Array): Promise<SlideTextData[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter((f) => !f.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(f.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/slide(\d+)/i)?.[1] ?? '0', 10);
      const nb = parseInt(b.name.match(/slide(\d+)/i)?.[1] ?? '0', 10);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error('No slides (ppt/slides/slide*.xml) found in this PPTX file.');
  }

  const slides: SlideTextData[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await slideFiles[i].async('string');
    const lines: string[] = [];
    for (const pm of xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
      const text = Array.from(pm[1].matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g))
        .map((m) => unescapeXml(m[1]))
        .join('')
        .trim();
      if (text) lines.push(text);
    }
    slides.push({
      index: i + 1,
      title: lines[0] || `Slide ${i + 1}`,
      lines: lines.slice(1),
    });
  }
  return slides;
}
