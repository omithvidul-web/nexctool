export type CategorySlug =
  | 'image-tools'
  | 'pdf-tools'
  | 'document-tools'
  | 'spreadsheet-tools'
  | 'presentation-tools'
  | 'video-tools'
  | 'audio-tools'
  | 'archive-tools'
  | 'text-developer-tools'
  | 'file-utilities';

export type ToolSupportMode = 'browser' | 'text-or-file' | 'coming-soon';

export interface ToolOptionConfig {
  type:
    | 'quality'
    | 'background'
    | 'dimensions'
    | 'rotation'
    | 'indent'
    | 'delimiter'
    | 'text-mode'
    | 'regex'
    | 'split-size'
    | 'size-unit'
    | 'crop'
    | 'watermark'
    | 'target-format'
    | 'page-range'
    | 'pdf-meta'
    | 'csv-split'
    | 'tolerance'
    | 'signature'
    | 'form-fields'
    | 'audio-trim'
    | 'audio-volume'
    | 'audio-speed'
    | 'audio-meta'
    | 'archive-target'
    | 'doc-watermark';
}

export interface CategoryMeta {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  expectedCount: number;
}

export type DevPreviewKind =
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

export interface ToolItem {
  id: number;
  name: string;
  slug: string;
  category: CategorySlug;
  categoryName: string;
  description: string;
  icon: string;
  accept: string;
  multiple: boolean;
  mode: ToolSupportMode;
  actionLabel: string;
  popular: boolean;
  optionType?: ToolOptionConfig['type'];
  lazyGroup?: 'image' | 'pdf' | 'spreadsheet' | 'office' | 'media' | 'text' | 'utility';
  previewKind?: DevPreviewKind;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'image-tools',
    name: 'Image Tools',
    shortName: 'Images',
    description: 'Convert, compress, resize, rotate, and optimize images locally in your browser.',
    icon: 'image',
    expectedCount: 30,
  },
  {
    slug: 'pdf-tools',
    name: 'PDF Tools',
    shortName: 'PDF',
    description: 'Merge, split, rotate, extract, and convert PDF documents without uploading.',
    icon: 'file-text',
    expectedCount: 30,
  },
  {
    slug: 'document-tools',
    name: 'Document Tools',
    shortName: 'Documents',
    description: 'Transform, inspect, and count words across text, Markdown, HTML, and office documents.',
    icon: 'book-open',
    expectedCount: 30,
  },
  {
    slug: 'spreadsheet-tools',
    name: 'Spreadsheet Tools',
    shortName: 'Spreadsheets',
    description: 'Convert CSV, TSV, JSON, and spreadsheet files cleanly on your own device.',
    icon: 'table',
    expectedCount: 20,
  },
  {
    slug: 'presentation-tools',
    name: 'Presentation Tools',
    shortName: 'Presentations',
    description: 'Convert, split, merge, and extract assets from presentation decks.',
    icon: 'presentation',
    expectedCount: 15,
  },
  {
    slug: 'video-tools',
    name: 'Video Tools',
    shortName: 'Video',
    description: 'Extract thumbnails, inspect metadata, and process video clips privately.',
    icon: 'video',
    expectedCount: 20,
  },
  {
    slug: 'audio-tools',
    name: 'Audio Tools',
    shortName: 'Audio',
    description: 'Convert, trim, and inspect audio files directly inside your browser.',
    icon: 'music',
    expectedCount: 15,
  },
  {
    slug: 'archive-tools',
    name: 'Archive Tools',
    shortName: 'Archives',
    description: 'Compress and decompress files cleanly with zero server transfers.',
    icon: 'archive',
    expectedCount: 12,
  },
  {
    slug: 'text-developer-tools',
    name: 'Text & Developer Tools',
    shortName: 'Developer',
    description: 'Preview HTML, CSS, Markdown, run JS & Python, inspect JSON/XML trees, format SQL, test Regex, and compare Text Diff.',
    icon: 'code',
    expectedCount: 27,
  },
  {
    slug: 'file-utilities',
    name: 'File Utilities',
    shortName: 'Utilities',
    description: 'Generate cryptographic hashes, inspect metadata, split, merge, and verify files.',
    icon: 'wrench',
    expectedCount: 10,
  },
];

interface RawToolSeed {
  id: number;
  name: string;
  category: CategorySlug;
  slug?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  mode?: ToolSupportMode;
  actionLabel?: string;
  popular?: boolean;
  optionType?: ToolOptionConfig['type'];
  lazyGroup?: ToolItem['lazyGroup'];
  previewKind?: DevPreviewKind;
}

export function slugifyToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\/\s*/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.slug, c]));

const DEFAULT_ACCEPT: Record<CategorySlug, string> = {
  'image-tools': 'image/*',
  'pdf-tools': '.pdf,application/pdf',
  'document-tools': '.txt,.md,.html,.htm,.docx,.odt,.rtf,.epub,.mobi',
  'spreadsheet-tools': '.csv,.tsv,.json,.xlsx,.xls,.ods',
  'presentation-tools': '.pptx,.ppt,.odp,.pdf',
  'video-tools': 'video/*',
  'audio-tools': 'audio/*',
  'archive-tools': '.zip,.gz,.tar,.7z,.rar,.bz2',
  'text-developer-tools': '.json,.html,.htm,.css,.js,.xml,.yaml,.yml,.sql,.txt',
  'file-utilities': '*/*',
};

const RAW_TOOLS: RawToolSeed[] = [
  // 1. IMAGE TOOLS (30)
  { id: 1, name: 'JPG to PNG', category: 'image-tools', accept: '.jpg,.jpeg,image/jpeg', mode: 'browser', actionLabel: 'Convert to PNG', popular: true, lazyGroup: 'image', description: 'Convert JPG/JPEG images to lossless PNG files instantly in your browser.' },
  { id: 2, name: 'PNG to JPG', category: 'image-tools', accept: '.png,image/png', mode: 'browser', actionLabel: 'Convert to JPG', popular: true, optionType: 'background', lazyGroup: 'image', description: 'Convert PNG images to lightweight JPG files with custom quality and background fill.' },
  { id: 3, name: 'JPG to WebP', category: 'image-tools', accept: '.jpg,.jpeg,image/jpeg', mode: 'browser', actionLabel: 'Convert to WebP', optionType: 'quality', lazyGroup: 'image', description: 'Convert JPG photos into modern, smaller WebP images locally.' },
  { id: 4, name: 'WebP to JPG', category: 'image-tools', accept: '.webp,image/webp', mode: 'browser', actionLabel: 'Convert to JPG', optionType: 'background', lazyGroup: 'image', description: 'Turn WebP images into universally compatible JPG files.' },
  { id: 5, name: 'PNG to WebP', category: 'image-tools', accept: '.png,image/png', mode: 'browser', actionLabel: 'Convert to WebP', optionType: 'quality', lazyGroup: 'image', description: 'Convert PNG graphics to WebP while preserving crisp transparency.' },
  { id: 6, name: 'WebP to PNG', category: 'image-tools', accept: '.webp,image/webp', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image', description: 'Convert WebP images to standard PNG format with transparency.' },
  { id: 7, name: 'JPG to AVIF', category: 'image-tools', accept: '.jpg,.jpeg,image/jpeg', mode: 'coming-soon' },
  { id: 8, name: 'AVIF to JPG', category: 'image-tools', accept: '.avif,image/avif', mode: 'browser', actionLabel: 'Convert to JPG', optionType: 'background', lazyGroup: 'image', description: 'Decode AVIF images and export universally compatible JPG files locally.' },
  { id: 9, name: 'PNG to AVIF', category: 'image-tools', accept: '.png,image/png', mode: 'coming-soon' },
  { id: 10, name: 'AVIF to PNG', category: 'image-tools', accept: '.avif,image/avif', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image', description: 'Convert AVIF images to lossless PNG format with transparency inside your browser.' },
  { id: 11, name: 'HEIC to JPG', category: 'image-tools', accept: '.heic,.heif', mode: 'browser', actionLabel: 'Convert to JPG', optionType: 'quality', lazyGroup: 'image', description: 'Convert Apple HEIC/HEIF photos into standard JPG images offline.' },
  { id: 12, name: 'HEIC to PNG', category: 'image-tools', accept: '.heic,.heif', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image', description: 'Decode iPhone HEIC/HEIF photos into lossless PNG images privately.' },
  { id: 13, name: 'SVG to PNG', category: 'image-tools', accept: '.svg,image/svg+xml', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image', description: 'Render vector SVG artwork into crisp raster PNG images.' },
  { id: 14, name: 'SVG to JPG', category: 'image-tools', accept: '.svg,image/svg+xml', mode: 'browser', actionLabel: 'Convert to JPG', optionType: 'background', lazyGroup: 'image', description: 'Export SVG vector files as high-resolution JPG images.' },
  { id: 15, name: 'PNG to SVG', category: 'image-tools', accept: '.png,image/png', mode: 'browser', actionLabel: 'Vectorize to SVG', lazyGroup: 'image', description: 'Trace raster PNG graphics into clean SVG vector rectangles locally.' },
  { id: 16, name: 'BMP to JPG', category: 'image-tools', accept: '.bmp,image/bmp', mode: 'browser', actionLabel: 'Convert to JPG', optionType: 'quality', lazyGroup: 'image' },
  { id: 17, name: 'BMP to PNG', category: 'image-tools', accept: '.bmp,image/bmp', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image' },
  { id: 18, name: 'TIFF to JPG', category: 'image-tools', accept: '.tif,.tiff,image/tiff', mode: 'browser', actionLabel: 'Convert to JPG', optionType: 'quality', lazyGroup: 'image', description: 'Decode TIFF files and convert them into lightweight JPG photos offline.' },
  { id: 19, name: 'TIFF to PNG', category: 'image-tools', accept: '.tif,.tiff,image/tiff', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image', description: 'Decode TIFF images into lossless PNG files directly inside your browser.' },
  { id: 20, name: 'GIF to PNG', category: 'image-tools', accept: '.gif,image/gif', mode: 'browser', actionLabel: 'Convert to PNG', lazyGroup: 'image' },
  { id: 21, name: 'GIF to WebP', category: 'image-tools', accept: '.gif,image/gif', mode: 'browser', actionLabel: 'Convert to WebP', optionType: 'quality', lazyGroup: 'image', description: 'Convert GIF frames into compact WebP images directly inside your browser.' },
  { id: 22, name: 'Image to PDF', category: 'image-tools', accept: '.jpg,.jpeg,.png,image/jpeg,image/png', multiple: true, mode: 'browser', actionLabel: 'Create PDF', popular: true, lazyGroup: 'pdf', description: 'Combine one or more JPG/PNG images into a clean PDF document locally.' },
  { id: 23, name: 'Image Compressor', category: 'image-tools', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', mode: 'browser', actionLabel: 'Compress Image', popular: true, optionType: 'quality', lazyGroup: 'image', description: 'Shrink JPG, PNG, and WebP file sizes right inside your browser with adjustable quality.' },
  { id: 24, name: 'Image Resizer', category: 'image-tools', accept: 'image/*', mode: 'browser', actionLabel: 'Resize Image', popular: true, optionType: 'dimensions', lazyGroup: 'image', description: 'Resize images to exact pixel width and height without uploading.' },
  { id: 25, name: 'Image Cropper', category: 'image-tools', accept: 'image/*', mode: 'browser', actionLabel: 'Crop Image', optionType: 'crop', lazyGroup: 'image', description: 'Center-crop photos to 1:1, 16:9, 4:3, 9:16, or 3:2 aspect ratios locally.' },
  { id: 26, name: 'Image Rotator', category: 'image-tools', accept: 'image/*', mode: 'browser', actionLabel: 'Rotate Image', optionType: 'rotation', lazyGroup: 'image', description: 'Rotate images 90, 180, or 270 degrees instantly inside your browser.' },
  { id: 27, name: 'Image Watermark', category: 'image-tools', accept: 'image/*', mode: 'browser', actionLabel: 'Apply Watermark', optionType: 'watermark', lazyGroup: 'image', description: 'Stamp custom text watermarks across photos with opacity & position controls locally.' },
  { id: 28, name: 'Image Background Remover', category: 'image-tools', accept: 'image/*', mode: 'browser', actionLabel: 'Remove Background', optionType: 'tolerance', lazyGroup: 'image', description: 'Flood-fill remove uniform solid backgrounds from images into transparent PNGs locally.' },
  { id: 29, name: 'Image Metadata Remover', category: 'image-tools', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', mode: 'browser', actionLabel: 'Strip Metadata', lazyGroup: 'image', description: 'Strip EXIF camera and location metadata by re-encoding cleanly in your browser.' },
  { id: 30, name: 'Batch Image Converter', category: 'image-tools', accept: 'image/*', multiple: true, mode: 'browser', actionLabel: 'Convert All Images', optionType: 'target-format', lazyGroup: 'image', description: 'Convert multiple images to PNG, JPG, or WebP in one batch and download as ZIP.' },

  // 2. PDF TOOLS (30)
  { id: 31, name: 'PDF to Word', category: 'pdf-tools', mode: 'browser', actionLabel: 'Convert to DOCX', lazyGroup: 'pdf', description: 'Extract PDF text into an editable Word (.docx) document directly inside your browser.' },
  { id: 32, name: 'Word to PDF', category: 'pdf-tools', accept: '.docx', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'pdf', description: 'Convert Word .docx documents into clean PDF pages locally with zero uploads.' },
  { id: 33, name: 'PDF to Excel', category: 'pdf-tools', mode: 'browser', actionLabel: 'Convert to XLSX', lazyGroup: 'pdf', description: 'Extract PDF page rows and columns into multi-sheet Excel (.xlsx) workbooks locally.' },
  { id: 34, name: 'Excel to PDF', category: 'pdf-tools', accept: '.xls,.xlsx,.ods,.csv', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'spreadsheet', description: 'Render Excel spreadsheets (.xlsx/.xls) into clean landscape PDF pages locally.' },
  { id: 35, name: 'PDF to PowerPoint', category: 'pdf-tools', mode: 'browser', actionLabel: 'Convert to PPTX', lazyGroup: 'pdf', description: 'Turn PDF pages into editable PowerPoint (.pptx) presentation slides offline.' },
  { id: 36, name: 'PowerPoint to PDF', category: 'pdf-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'office', description: 'Export PowerPoint .pptx slide decks as widescreen PDF documents locally.' },
  { id: 37, name: 'PDF to JPG', category: 'pdf-tools', mode: 'browser', actionLabel: 'Render PDF to JPG', optionType: 'quality', lazyGroup: 'pdf', description: 'Render every PDF page into high-resolution JPG images inside your browser.' },
  { id: 38, name: 'PDF to PNG', category: 'pdf-tools', mode: 'browser', actionLabel: 'Render PDF to PNG', lazyGroup: 'pdf', description: 'Render every PDF page as crisp lossless PNG images locally.' },
  { id: 39, name: 'JPG to PDF', category: 'pdf-tools', accept: '.jpg,.jpeg,image/jpeg', multiple: true, mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'pdf', description: 'Convert JPG photos into a downloadable PDF document in your browser.' },
  { id: 40, name: 'PNG to PDF', category: 'pdf-tools', accept: '.png,image/png', multiple: true, mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'pdf', description: 'Convert PNG images into a clean PDF document privately.' },
  { id: 41, name: 'PDF to TXT', category: 'pdf-tools', mode: 'browser', actionLabel: 'Extract to TXT', lazyGroup: 'pdf', description: 'Extract readable plain text from all PDF pages privately in your browser.' },
  { id: 42, name: 'PDF to HTML', category: 'pdf-tools', mode: 'browser', actionLabel: 'Convert to HTML', lazyGroup: 'pdf', description: 'Convert PDF page content into semantic HTML sections offline.' },
  { id: 43, name: 'PDF to Markdown', category: 'pdf-tools', mode: 'browser', actionLabel: 'Convert to Markdown', lazyGroup: 'pdf', description: 'Export PDF text structured into clean Markdown pages locally.' },
  { id: 44, name: 'PDF Compressor', category: 'pdf-tools', mode: 'browser', actionLabel: 'Compress PDF', optionType: 'quality', lazyGroup: 'pdf', description: 'Optimize and recompress heavy PDF pages to shrink file size privately.' },
  { id: 45, name: 'Merge PDF', category: 'pdf-tools', multiple: true, mode: 'browser', actionLabel: 'Merge PDF', popular: true, lazyGroup: 'pdf', description: 'Combine multiple PDF files into one single PDF document 100% locally.' },
  { id: 46, name: 'Split PDF', category: 'pdf-tools', mode: 'browser', actionLabel: 'Split All Pages', lazyGroup: 'pdf', description: 'Split a PDF into individual standalone page files and download individually or as ZIP.' },
  { id: 47, name: 'Extract PDF Pages', category: 'pdf-tools', mode: 'browser', actionLabel: 'Extract Pages', optionType: 'page-range', lazyGroup: 'pdf', description: 'Extract specific PDF page numbers or ranges (e.g. 1, 3-5) into a new PDF.' },
  { id: 48, name: 'Delete PDF Pages', category: 'pdf-tools', mode: 'browser', actionLabel: 'Delete Pages', optionType: 'page-range', lazyGroup: 'pdf', description: 'Remove unwanted pages from any PDF document directly inside your browser.' },
  { id: 49, name: 'Reorder PDF Pages', category: 'pdf-tools', mode: 'browser', actionLabel: 'Reorder Pages', optionType: 'page-range', lazyGroup: 'pdf', description: 'Rearrange PDF pages in any custom order (e.g. 3, 1, 2) inside your browser.' },
  { id: 50, name: 'Rotate PDF Pages', category: 'pdf-tools', mode: 'browser', actionLabel: 'Rotate PDF', popular: true, optionType: 'rotation', lazyGroup: 'pdf', description: 'Rotate all pages in a PDF document by 90, 180, or 270 degrees locally.' },
  { id: 51, name: 'PDF Watermark', category: 'pdf-tools', mode: 'browser', actionLabel: 'Add Watermark', optionType: 'watermark', lazyGroup: 'pdf', description: 'Stamp custom diagonal text watermarks onto every PDF page locally.' },
  { id: 52, name: 'PDF Page Numbers', category: 'pdf-tools', mode: 'browser', actionLabel: 'Add Page Numbers', lazyGroup: 'pdf', description: 'Stamp clean footer page numbers onto every page of a PDF locally.' },
  { id: 53, name: 'PDF Password Protect', category: 'pdf-tools', mode: 'coming-soon' },
  { id: 54, name: 'PDF Unlock', category: 'pdf-tools', mode: 'browser', actionLabel: 'Unlock Restrictions', lazyGroup: 'pdf', description: 'Remove owner editing & print restrictions from permission-locked PDFs locally.' },
  { id: 55, name: 'PDF OCR', category: 'pdf-tools', mode: 'coming-soon' },
  { id: 56, name: 'PDF Text Extractor', category: 'pdf-tools', mode: 'browser', actionLabel: 'Extract Text', lazyGroup: 'pdf', description: 'Extract selectable text page by page from any PDF document offline.' },
  { id: 57, name: 'PDF Signer', category: 'pdf-tools', mode: 'browser', actionLabel: 'Sign PDF', optionType: 'signature', lazyGroup: 'pdf', description: 'Stamp a clean signature block with date onto the final page of your PDF locally.' },
  { id: 58, name: 'PDF Form Filler', category: 'pdf-tools', mode: 'browser', actionLabel: 'Fill PDF Form', optionType: 'form-fields', lazyGroup: 'pdf', description: 'Inspect and populate AcroForm text & checkbox fields inside PDFs privately.' },
  { id: 59, name: 'PDF Metadata Editor', category: 'pdf-tools', mode: 'browser', actionLabel: 'Update Metadata', optionType: 'pdf-meta', lazyGroup: 'pdf', description: 'Edit PDF Title, Author, and Subject properties right inside your browser.' },
  { id: 60, name: 'PDF Compare', category: 'pdf-tools', multiple: true, mode: 'browser', actionLabel: 'Compare PDFs', lazyGroup: 'pdf', description: 'Compare two PDF documents line by line and inspect added or removed content.' },

  // 3. DOCUMENT TOOLS (30)
  { id: 61, name: 'DOCX to TXT', category: 'document-tools', accept: '.docx', mode: 'browser', actionLabel: 'Extract to TXT', lazyGroup: 'office', description: 'Extract clean plain text paragraphs from Word .docx files locally.' },
  { id: 62, name: 'DOCX to HTML', category: 'document-tools', accept: '.docx', mode: 'browser', actionLabel: 'Convert to HTML', lazyGroup: 'office', description: 'Convert Word .docx paragraphs into clean semantic HTML offline.' },
  { id: 63, name: 'DOCX to RTF', category: 'document-tools', accept: '.docx', mode: 'browser', actionLabel: 'Convert to RTF', lazyGroup: 'office', description: 'Export Word .docx content into Rich Text Format (.rtf) locally.' },
  { id: 64, name: 'DOCX to ODT', category: 'document-tools', accept: '.docx', mode: 'browser', actionLabel: 'Convert to ODT', lazyGroup: 'office', description: 'Convert Word .docx documents into OpenDocument Text (.odt) inside your browser.' },
  { id: 65, name: 'ODT to DOCX', category: 'document-tools', accept: '.odt', mode: 'browser', actionLabel: 'Convert to DOCX', lazyGroup: 'office', description: 'Convert OpenDocument .odt files into Microsoft Word (.docx) locally.' },
  { id: 66, name: 'RTF to DOCX', category: 'document-tools', accept: '.rtf', mode: 'browser', actionLabel: 'Convert to DOCX', lazyGroup: 'office', description: 'Convert Rich Text Format (.rtf) files into editable .docx documents offline.' },
  { id: 67, name: 'RTF to PDF', category: 'document-tools', accept: '.rtf', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'office', description: 'Render Rich Text Format (.rtf) files into clean PDF documents privately.' },
  { id: 68, name: 'TXT to PDF', category: 'document-tools', accept: '.txt,text/plain', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'pdf', description: 'Convert plain text files into clean formatted PDF documents inside your browser.' },
  { id: 69, name: 'TXT to DOCX', category: 'document-tools', accept: '.txt,text/plain', mode: 'text-or-file', actionLabel: 'Convert to DOCX', lazyGroup: 'office', description: 'Turn plain text or pasted notes into a formatted Word (.docx) file locally.' },
  { id: 70, name: 'TXT to HTML', category: 'document-tools', accept: '.txt,text/plain', mode: 'text-or-file', actionLabel: 'Convert to HTML', lazyGroup: 'text' },
  { id: 71, name: 'HTML to DOCX', category: 'document-tools', accept: '.html,.htm', mode: 'text-or-file', actionLabel: 'Convert to DOCX', lazyGroup: 'office', description: 'Convert HTML content or files into downloadable Word (.docx) documents.' },
  { id: 72, name: 'HTML to TXT', category: 'document-tools', accept: '.html,.htm', mode: 'text-or-file', actionLabel: 'Extract Text', lazyGroup: 'text' },
  { id: 73, name: 'Markdown to HTML', category: 'document-tools', accept: '.md,.markdown', mode: 'text-or-file', actionLabel: 'Convert to HTML', lazyGroup: 'text' },
  { id: 74, name: 'Markdown to PDF', category: 'document-tools', accept: '.md,.markdown,.txt', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'pdf', description: 'Render Markdown headings, lists, and paragraphs into a clean PDF document locally.' },
  { id: 75, name: 'Markdown to DOCX', category: 'document-tools', accept: '.md,.markdown,.txt', mode: 'text-or-file', actionLabel: 'Convert to DOCX', lazyGroup: 'office', description: 'Convert Markdown documents into Microsoft Word (.docx) files privately.' },
  { id: 76, name: 'HTML to Markdown', category: 'document-tools', accept: '.html,.htm', mode: 'text-or-file', actionLabel: 'Convert to Markdown', lazyGroup: 'text', description: 'Convert HTML markup into clean, readable Markdown syntax locally.' },
  { id: 77, name: 'EPUB to PDF', category: 'document-tools', accept: '.epub', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'office', description: 'Extract EPUB eBook chapters and render them into a readable PDF locally.' },
  { id: 78, name: 'PDF to EPUB', category: 'document-tools', accept: '.pdf', mode: 'browser', actionLabel: 'Convert to EPUB', lazyGroup: 'pdf', description: 'Convert PDF documents into standards-compliant EPUB eBooks offline.' },
  { id: 79, name: 'EPUB to TXT', category: 'document-tools', accept: '.epub', mode: 'browser', actionLabel: 'Extract to TXT', lazyGroup: 'office', description: 'Extract chapter text from EPUB eBooks into clean plain text locally.' },
  { id: 80, name: 'MOBI to EPUB', category: 'document-tools', accept: '.mobi', mode: 'coming-soon' },
  { id: 81, name: 'EPUB to MOBI', category: 'document-tools', accept: '.epub', mode: 'coming-soon' },
  { id: 82, name: 'DOCX Merger', category: 'document-tools', accept: '.docx', multiple: true, mode: 'browser', actionLabel: 'Merge DOCX Files', lazyGroup: 'office', description: 'Combine multiple Word .docx documents sequentially into one .docx locally.' },
  { id: 83, name: 'DOCX Splitter', category: 'document-tools', accept: '.docx', mode: 'browser', actionLabel: 'Split DOCX', lazyGroup: 'office', description: 'Split large Word .docx documents into smaller standalone .docx parts.' },
  { id: 84, name: 'Document Word Counter', category: 'document-tools', accept: '.txt,.md,.html,.csv', mode: 'text-or-file', actionLabel: 'Count Words', lazyGroup: 'text', description: 'Count words, sentences, lines, and reading time locally in your browser.' },
  { id: 85, name: 'Document Character Counter', category: 'document-tools', accept: '.txt,.md,.html,.csv', mode: 'text-or-file', actionLabel: 'Count Characters', lazyGroup: 'text' },
  { id: 86, name: 'Document Text Extractor', category: 'document-tools', accept: '.docx,.odt,.rtf,.epub,.html,.htm,.txt,.md', mode: 'browser', actionLabel: 'Extract Text', lazyGroup: 'office', description: 'Extract readable text from DOCX, ODT, RTF, EPUB, HTML, and TXT documents.' },
  { id: 87, name: 'Document Page Counter', category: 'document-tools', accept: '.docx,.odt,.rtf,.epub,.txt,.md', mode: 'browser', actionLabel: 'Count Pages & Words', lazyGroup: 'office', description: 'Estimate page count, paragraphs, and word totals across office documents.' },
  { id: 88, name: 'Document Metadata Viewer', category: 'document-tools', accept: '.docx,.odt,.rtf,.epub,.txt,.md', mode: 'browser', actionLabel: 'Inspect Metadata', lazyGroup: 'office', description: 'View format, size, paragraph, word, and timestamp stats for documents locally.' },
  { id: 89, name: 'Document Compare', category: 'document-tools', accept: '.docx,.odt,.rtf,.txt,.md', multiple: true, mode: 'browser', actionLabel: 'Compare Documents', lazyGroup: 'office', description: 'Compare two documents line by line and inspect added or removed paragraphs.' },
  { id: 90, name: 'Document Watermark', category: 'document-tools', accept: '.docx,.odt,.rtf,.txt,.md', mode: 'browser', actionLabel: 'Add Watermark', optionType: 'doc-watermark', lazyGroup: 'office', description: 'Stamp a custom document watermark header and footer into a DOCX copy locally.' },

  // 4. SPREADSHEET TOOLS (20)
  { id: 91, name: 'XLSX to CSV', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods', mode: 'browser', actionLabel: 'Convert to CSV', lazyGroup: 'spreadsheet', description: 'Export Excel .xlsx/.xls/.ods worksheets cleanly to CSV in your browser.' },
  { id: 92, name: 'CSV to XLSX', category: 'spreadsheet-tools', accept: '.csv,text/csv', mode: 'text-or-file', actionLabel: 'Convert to XLSX', lazyGroup: 'spreadsheet', description: 'Convert CSV files or pasted table rows into Excel .xlsx workbooks locally.' },
  { id: 93, name: 'XLSX to PDF', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'spreadsheet', description: 'Render Excel spreadsheets into clean multi-page landscape PDFs privately.' },
  { id: 94, name: 'XLSX to HTML', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods', mode: 'browser', actionLabel: 'Convert to HTML', lazyGroup: 'spreadsheet', description: 'Export Excel sheets into clean HTML table markup inside your browser.' },
  { id: 95, name: 'XLSX to JSON', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods', mode: 'browser', actionLabel: 'Convert to JSON', lazyGroup: 'spreadsheet', description: 'Convert Excel worksheet rows into structured JSON objects locally.' },
  { id: 96, name: 'JSON to XLSX', category: 'spreadsheet-tools', accept: '.json,application/json', mode: 'text-or-file', actionLabel: 'Convert to XLSX', lazyGroup: 'spreadsheet', description: 'Convert JSON object arrays into downloadable Excel .xlsx workbooks offline.' },
  { id: 97, name: 'CSV to JSON', category: 'spreadsheet-tools', accept: '.csv,text/csv', mode: 'text-or-file', actionLabel: 'Convert to JSON', popular: true, lazyGroup: 'text', description: 'Convert CSV spreadsheet tables into structured JSON arrays locally.' },
  { id: 98, name: 'JSON to CSV', category: 'spreadsheet-tools', accept: '.json,application/json', mode: 'text-or-file', actionLabel: 'Convert to CSV', lazyGroup: 'text', description: 'Convert JSON object arrays into clean downloadable CSV spreadsheets.' },
  { id: 99, name: 'CSV to TSV', category: 'spreadsheet-tools', accept: '.csv,text/csv', mode: 'text-or-file', actionLabel: 'Convert to TSV', lazyGroup: 'text' },
  { id: 100, name: 'TSV to CSV', category: 'spreadsheet-tools', accept: '.tsv,text/tab-separated-values', mode: 'text-or-file', actionLabel: 'Convert to CSV', lazyGroup: 'text' },
  { id: 101, name: 'XLS to XLSX', category: 'spreadsheet-tools', accept: '.xls', mode: 'browser', actionLabel: 'Upgrade to XLSX', lazyGroup: 'spreadsheet', description: 'Convert legacy Excel .xls files into modern .xlsx workbooks privately.' },
  { id: 102, name: 'XLSX to ODS', category: 'spreadsheet-tools', accept: '.xlsx,.xls', mode: 'browser', actionLabel: 'Convert to ODS', lazyGroup: 'spreadsheet', description: 'Convert Excel spreadsheets to OpenDocument Spreadsheet (.ods) offline.' },
  { id: 103, name: 'ODS to XLSX', category: 'spreadsheet-tools', accept: '.ods', mode: 'browser', actionLabel: 'Convert to XLSX', lazyGroup: 'spreadsheet', description: 'Convert OpenDocument .ods sheets to Microsoft Excel .xlsx locally.' },
  { id: 104, name: 'Excel Sheet Merger', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods', multiple: true, mode: 'browser', actionLabel: 'Merge Workbooks', lazyGroup: 'spreadsheet', description: 'Combine worksheets from multiple Excel files into one unified .xlsx workbook.' },
  { id: 105, name: 'Excel Sheet Splitter', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods', mode: 'browser', actionLabel: 'Split Worksheets', lazyGroup: 'spreadsheet', description: 'Split a multi-sheet Excel workbook into separate .xlsx files per tab.' },
  { id: 106, name: 'CSV Merger', category: 'spreadsheet-tools', accept: '.csv,text/csv', multiple: true, mode: 'browser', actionLabel: 'Merge CSV Files', lazyGroup: 'text' },
  { id: 107, name: 'CSV Splitter', category: 'spreadsheet-tools', accept: '.csv,text/csv', mode: 'text-or-file', actionLabel: 'Split CSV', optionType: 'csv-split', lazyGroup: 'text', description: 'Split large CSV files into smaller chunks while preserving headers in every file.' },
  { id: 108, name: 'CSV Cleaner', category: 'spreadsheet-tools', accept: '.csv,text/csv', mode: 'text-or-file', actionLabel: 'Clean CSV', lazyGroup: 'text' },
  { id: 109, name: 'Duplicate Row Remover', category: 'spreadsheet-tools', accept: '.csv,.txt', mode: 'text-or-file', actionLabel: 'Remove Duplicates', lazyGroup: 'text' },
  { id: 110, name: 'Spreadsheet Formula Checker', category: 'spreadsheet-tools', accept: '.xlsx,.xls,.ods,.csv', mode: 'browser', actionLabel: 'Audit Formulas', lazyGroup: 'spreadsheet', description: 'Scan Excel workbooks for formulas and broken #REF!, #DIV/0!, or #NAME? errors.' },

  // 5. PRESENTATION TOOLS (15)
  { id: 111, name: 'PPTX to PDF', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Convert to PDF', lazyGroup: 'office', description: 'Render PowerPoint .pptx slide decks into clean 16:9 PDF pages locally.' },
  { id: 112, name: 'PDF to PPTX', category: 'presentation-tools', accept: '.pdf', mode: 'browser', actionLabel: 'Convert to PPTX', lazyGroup: 'pdf', description: 'Turn PDF pages into editable PowerPoint .pptx slides inside your browser.' },
  { id: 113, name: 'PPTX to JPG', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Export Slides as JPG', lazyGroup: 'office', description: 'Render every slide in a .pptx presentation as crisp JPG images offline.' },
  { id: 114, name: 'PPTX to PNG', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Export Slides as PNG', lazyGroup: 'office', description: 'Render every .pptx slide as lossless PNG images right inside your browser.' },
  { id: 115, name: 'PPTX to HTML', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Convert to HTML', lazyGroup: 'office', description: 'Convert PowerPoint slide titles and bullets into semantic HTML sections.' },
  { id: 116, name: 'PPTX to TXT', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Extract Slide Text', lazyGroup: 'office', description: 'Extract slide-by-slide plain text from PowerPoint .pptx decks locally.' },
  { id: 117, name: 'PPTX to ODP', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Convert to ODP', lazyGroup: 'office', description: 'Convert PowerPoint .pptx presentations into OpenDocument Presentation (.odp).' },
  { id: 118, name: 'ODP to PPTX', category: 'presentation-tools', accept: '.odp', mode: 'browser', actionLabel: 'Convert to PPTX', lazyGroup: 'office', description: 'Convert OpenDocument .odp presentations into Microsoft PowerPoint (.pptx).' },
  { id: 119, name: 'PPTX Merger', category: 'presentation-tools', accept: '.pptx', multiple: true, mode: 'browser', actionLabel: 'Merge Presentations', lazyGroup: 'office', description: 'Combine multiple PowerPoint .pptx decks sequentially into a single deck.' },
  { id: 120, name: 'PPTX Splitter', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Split Slides', lazyGroup: 'office', description: 'Split a .pptx presentation into individual slide .pptx files and ZIP download.' },
  { id: 121, name: 'Presentation Compressor', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Compress PPTX', lazyGroup: 'office', description: 'Recompress .pptx ZIP streams with maximum DEFLATE compression locally.' },
  { id: 122, name: 'Slide Extractor', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Extract Slides', lazyGroup: 'office', description: 'Extract standalone single-slide .pptx files from any PowerPoint presentation.' },
  { id: 123, name: 'Slide Image Extractor', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Extract Media Images', lazyGroup: 'office', description: 'Pull all original embedded photos & graphics from ppt/media/ inside a .pptx.' },
  { id: 124, name: 'Presentation Metadata Viewer', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'View Deck Metadata', lazyGroup: 'office', description: 'Inspect slide counts, word counts, and slide outline summary locally.' },
  { id: 125, name: 'Presentation Text Extractor', category: 'presentation-tools', accept: '.pptx', mode: 'browser', actionLabel: 'Extract All Text', lazyGroup: 'office', description: 'Extract readable speaker/slide copy across every slide in a .pptx deck.' },

  // 6. VIDEO TOOLS (20)
  { id: 126, name: 'MP4 to WebM', category: 'video-tools', accept: '.mp4,video/mp4', mode: 'browser', actionLabel: 'Convert to WebM', lazyGroup: 'media', description: 'Re-encode browser-playable MP4 clips into WebM format right inside your browser.' },
  { id: 127, name: 'WebM to MP4', category: 'video-tools', accept: '.webm,video/webm', mode: 'browser', actionLabel: 'Convert to MP4', lazyGroup: 'media', description: 'Convert WebM recordings into MP4/WebM video locally with zero uploads.' },
  { id: 128, name: 'MOV to MP4', category: 'video-tools', accept: '.mov,video/quicktime,video/mp4', mode: 'browser', actionLabel: 'Convert to MP4', lazyGroup: 'media', description: 'Re-encode browser-supported QuickTime .mov clips locally in your browser.' },
  { id: 129, name: 'AVI to MP4', category: 'video-tools', accept: '.avi,video/x-msvideo', mode: 'coming-soon', lazyGroup: 'media' },
  { id: 130, name: 'MKV to MP4', category: 'video-tools', accept: '.mkv', mode: 'coming-soon', lazyGroup: 'media' },
  { id: 131, name: 'MP4 to MOV', category: 'video-tools', accept: '.mp4', mode: 'coming-soon', lazyGroup: 'media' },
  { id: 132, name: 'Video Compressor', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Compress Video', optionType: 'quality', lazyGroup: 'media', description: 'Lower video bitrate cleanly in your browser to shrink clip size privately.' },
  { id: 133, name: 'Video Resizer', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Resize Video', optionType: 'dimensions', lazyGroup: 'media', description: 'Scale video clips to custom pixel width and height directly in your browser.' },
  { id: 134, name: 'Video Trimmer', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Trim Video', optionType: 'audio-trim', lazyGroup: 'media', description: 'Cut a video clip between custom start and end timestamps locally.' },
  { id: 135, name: 'Video Merger', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', multiple: true, mode: 'browser', actionLabel: 'Merge Videos', lazyGroup: 'media', description: 'Join multiple browser-playable video clips sequentially into one video.' },
  { id: 136, name: 'Video to GIF', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Convert to GIF', lazyGroup: 'media', description: 'Sample video frames into a smooth animated GIF89a image locally.' },
  { id: 137, name: 'GIF to MP4', category: 'video-tools', accept: '.gif,image/gif', mode: 'browser', actionLabel: 'Convert GIF to Video', lazyGroup: 'media', description: 'Record animated GIF playback into a lightweight video file locally.' },
  { id: 138, name: 'Video to MP3', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Extract Audio as MP3', lazyGroup: 'media', description: 'Extract and encode the audio track from a video into MP3 offline.' },
  { id: 139, name: 'Video to WAV', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Extract Audio as WAV', lazyGroup: 'media', description: 'Extract uncompressed PCM WAV audio directly from video files locally.' },
  { id: 140, name: 'Video Thumbnail Extractor', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Extract Thumbnail', lazyGroup: 'media', description: 'Capture a crisp PNG frame from any browser-supported video file locally.' },
  { id: 141, name: 'Video Frame Extractor', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Extract Frame', lazyGroup: 'media' },
  { id: 142, name: 'Video Speed Changer', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Change Video Speed', optionType: 'audio-speed', lazyGroup: 'media', description: 'Speed up or slow down video playback (0.5x to 2.5x) inside your browser.' },
  { id: 143, name: 'Video Rotator', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Rotate Video', optionType: 'rotation', lazyGroup: 'media', description: 'Rotate sideways phone videos by 90, 180, or 270 degrees privately.' },
  { id: 144, name: 'Video Metadata Viewer', category: 'video-tools', accept: 'video/*', mode: 'browser', actionLabel: 'Inspect Video', lazyGroup: 'media', description: 'View resolution, duration, MIME type, and file properties locally.' },
  { id: 145, name: 'Video Audio Remover', category: 'video-tools', accept: 'video/*,.mp4,.webm,.mov,.m4v', mode: 'browser', actionLabel: 'Mute / Strip Audio', lazyGroup: 'media', description: 'Export a silent video clip with its audio track completely removed offline.' },

  // 7. AUDIO TOOLS (15)
  { id: 146, name: 'MP3 to WAV', category: 'audio-tools', accept: '.mp3,audio/mpeg', mode: 'browser', actionLabel: 'Convert to WAV', lazyGroup: 'media', description: 'Decode MP3 audio to uncompressed PCM WAV directly inside your browser.' },
  { id: 147, name: 'WAV to MP3', category: 'audio-tools', accept: '.wav,audio/wav', mode: 'browser', actionLabel: 'Convert to MP3', lazyGroup: 'media', description: 'Encode uncompressed WAV audio to crisp 128 kbps MP3 inside your browser.' },
  { id: 148, name: 'M4A to MP3', category: 'audio-tools', accept: '.m4a,audio/mp4', mode: 'browser', actionLabel: 'Convert to MP3', lazyGroup: 'media', description: 'Decode M4A audio files and encode to MP3 locally with zero server uploads.' },
  { id: 149, name: 'FLAC to MP3', category: 'audio-tools', accept: '.flac,audio/flac', mode: 'browser', actionLabel: 'Convert to MP3', lazyGroup: 'media', description: 'Transcode lossless FLAC tracks to portable MP3 inside your browser.' },
  { id: 150, name: 'OGG to MP3', category: 'audio-tools', accept: '.ogg,audio/ogg', mode: 'browser', actionLabel: 'Convert to MP3', lazyGroup: 'media', description: 'Convert OGG Vorbis audio files to standard MP3 offline.' },
  { id: 151, name: 'MP3 to AAC', category: 'audio-tools', accept: '.mp3', mode: 'coming-soon', lazyGroup: 'media' },
  { id: 152, name: 'AAC to MP3', category: 'audio-tools', accept: '.aac,audio/aac', mode: 'browser', actionLabel: 'Convert to MP3', lazyGroup: 'media', description: 'Decode AAC audio streams and re-encode as MP3 locally.' },
  { id: 153, name: 'WAV to FLAC', category: 'audio-tools', accept: '.wav', mode: 'coming-soon', lazyGroup: 'media' },
  { id: 154, name: 'Audio Compressor', category: 'audio-tools', accept: 'audio/*', mode: 'browser', actionLabel: 'Compress Audio', lazyGroup: 'media', description: 'Apply Web Audio dynamic range compression and export smaller MP3 files.' },
  { id: 155, name: 'Audio Trimmer', category: 'audio-tools', accept: 'audio/*', mode: 'browser', actionLabel: 'Trim Audio', optionType: 'audio-trim', lazyGroup: 'media', description: 'Cut audio files to exact start and end seconds right inside your browser.' },
  { id: 156, name: 'Audio Merger', category: 'audio-tools', accept: 'audio/*', multiple: true, mode: 'browser', actionLabel: 'Merge Audio Files', lazyGroup: 'media', description: 'Concatenate multiple audio clips sequentially into one seamless track.' },
  { id: 157, name: 'Audio Silence Remover', category: 'audio-tools', accept: 'audio/*', mode: 'browser', actionLabel: 'Strip Silence', lazyGroup: 'media', description: 'Automatically detect and remove quiet dead-air gaps from audio recordings.' },
  { id: 158, name: 'Audio Speed Changer', category: 'audio-tools', accept: 'audio/*', mode: 'browser', actionLabel: 'Change Speed', optionType: 'audio-speed', lazyGroup: 'media', description: 'Speed up or slow down audio tracks smoothly from 0.5x to 2.5x locally.' },
  { id: 159, name: 'Audio Volume Changer', category: 'audio-tools', accept: 'audio/*', mode: 'browser', actionLabel: 'Adjust Volume', optionType: 'audio-volume', lazyGroup: 'media', description: 'Boost or lower audio gain cleanly with Web Audio precision offline.' },
  { id: 160, name: 'Audio Metadata Editor', category: 'audio-tools', accept: '.mp3,audio/*', mode: 'browser', actionLabel: 'Update ID3 Tags', optionType: 'audio-meta', lazyGroup: 'media', description: 'Edit MP3 Title, Artist, and Album ID3v2 tags directly in your browser.' },

  // 8. ARCHIVE TOOLS (12)
  { id: 161, name: 'ZIP Creator', category: 'archive-tools', accept: '*/*', multiple: true, mode: 'browser', actionLabel: 'Create ZIP Archive', popular: true, lazyGroup: 'utility', description: 'Compress multiple files into a standard .zip archive locally inside your browser.' },
  { id: 162, name: 'ZIP Extractor', category: 'archive-tools', accept: '.zip,application/zip', mode: 'browser', actionLabel: 'Extract ZIP Files', lazyGroup: 'utility', description: 'Inspect and extract all files from a .zip archive directly in your browser.' },
  { id: 163, name: '7Z Extractor', category: 'archive-tools', accept: '.7z', mode: 'coming-soon' },
  { id: 164, name: '7Z Creator', category: 'archive-tools', accept: '*/*', multiple: true, mode: 'coming-soon' },
  { id: 165, name: 'RAR Extractor', category: 'archive-tools', accept: '.rar', mode: 'coming-soon', description: 'Extract files from RAR archives without leaving your device.' },
  { id: 166, name: 'TAR Extractor', category: 'archive-tools', accept: '.tar,.tar.gz,.tgz', mode: 'browser', actionLabel: 'Extract TAR Archive', lazyGroup: 'utility', description: 'Extract files from .tar and .tar.gz archives directly in your browser.' },
  { id: 167, name: 'TAR Creator', category: 'archive-tools', accept: '*/*', multiple: true, mode: 'browser', actionLabel: 'Create TAR Archive', lazyGroup: 'utility', description: 'Pack multiple files into a POSIX USTAR .tar archive 100% locally.' },
  { id: 168, name: 'GZIP Compressor', category: 'archive-tools', accept: '*/*', mode: 'browser', actionLabel: 'Compress to GZIP', lazyGroup: 'utility', description: 'Compress any file to .gz using your browser’s built-in CompressionStream API.' },
  { id: 169, name: 'GZIP Extractor', category: 'archive-tools', accept: '.gz,.gzip', mode: 'browser', actionLabel: 'Extract GZIP', lazyGroup: 'utility', description: 'Decompress .gz files locally with your browser’s native DecompressionStream API.' },
  { id: 170, name: 'BZIP2 Extractor', category: 'archive-tools', accept: '.bz2', mode: 'coming-soon' },
  { id: 171, name: 'Archive Converter', category: 'archive-tools', accept: '.zip,.tar,.gz,.tgz', mode: 'browser', actionLabel: 'Convert Archive', optionType: 'archive-target', lazyGroup: 'utility', description: 'Convert between ZIP, TAR, and TAR.GZ archives cleanly without server uploads.' },
  { id: 172, name: 'Archive File Viewer', category: 'archive-tools', accept: '.zip,.tar,.gz,.tgz', mode: 'browser', actionLabel: 'Inspect Archive', lazyGroup: 'utility', description: 'Preview file names and unpacked sizes inside ZIP, TAR, and GZIP archives.' },

  // 9. TEXT & DEVELOPER TOOLS (18)
  { id: 173, name: 'HTML Formatter', category: 'text-developer-tools', accept: '.html,.htm,.txt', mode: 'text-or-file', actionLabel: 'Format HTML', lazyGroup: 'text' },
  { id: 174, name: 'HTML Minifier', category: 'text-developer-tools', accept: '.html,.htm,.txt', mode: 'text-or-file', actionLabel: 'Minify HTML', lazyGroup: 'text' },
  { id: 175, name: 'CSS Formatter', category: 'text-developer-tools', accept: '.css,.txt', mode: 'text-or-file', actionLabel: 'Format CSS', lazyGroup: 'text' },
  { id: 176, name: 'CSS Minifier', category: 'text-developer-tools', accept: '.css,.txt', mode: 'text-or-file', actionLabel: 'Minify CSS', lazyGroup: 'text' },
  { id: 177, name: 'JavaScript Formatter', category: 'text-developer-tools', accept: '.js,.mjs,.txt', mode: 'text-or-file', actionLabel: 'Format JavaScript', lazyGroup: 'text', description: 'Cleanly indent and beautify JavaScript code right inside your browser.' },
  { id: 178, name: 'JavaScript Minifier', category: 'text-developer-tools', accept: '.js,.mjs,.txt', mode: 'text-or-file', actionLabel: 'Minify JS', lazyGroup: 'text' },
  { id: 179, name: 'JSON Formatter', category: 'text-developer-tools', accept: '.json,.txt,application/json', mode: 'text-or-file', actionLabel: 'Format JSON', popular: true, optionType: 'indent', lazyGroup: 'text', description: 'Beautify, indent, minify, and validate JSON data right inside your browser.' },
  { id: 180, name: 'JSON Validator', category: 'text-developer-tools', accept: '.json,.txt,application/json', mode: 'text-or-file', actionLabel: 'Validate JSON', lazyGroup: 'text', description: 'Check JSON syntax and pinpoint structural errors instantly offline.' },
  { id: 181, name: 'XML Formatter', category: 'text-developer-tools', accept: '.xml,.svg,.txt', mode: 'text-or-file', actionLabel: 'Format XML', lazyGroup: 'text' },
  { id: 182, name: 'XML Validator', category: 'text-developer-tools', accept: '.xml,.txt', mode: 'text-or-file', actionLabel: 'Validate XML', lazyGroup: 'text' },
  { id: 183, name: 'YAML to JSON', category: 'text-developer-tools', accept: '.yaml,.yml,.txt', mode: 'text-or-file', actionLabel: 'Convert to JSON', lazyGroup: 'text', description: 'Convert YAML configuration files into clean formatted JSON locally.' },
  { id: 184, name: 'JSON to YAML', category: 'text-developer-tools', accept: '.json,.txt,application/json', mode: 'text-or-file', actionLabel: 'Convert to YAML', lazyGroup: 'text', description: 'Convert JSON objects and arrays into readable YAML syntax locally.' },
  { id: 185, name: 'XML to JSON', category: 'text-developer-tools', accept: '.xml,.txt', mode: 'text-or-file', actionLabel: 'Convert to JSON', lazyGroup: 'text', description: 'Parse XML markup into clean structured JSON inside your browser.' },
  { id: 186, name: 'JSON to XML', category: 'text-developer-tools', accept: '.json,.txt,application/json', mode: 'text-or-file', actionLabel: 'Convert to XML', lazyGroup: 'text', description: 'Serialize JSON structures into valid indented XML documents locally.' },
  { id: 187, name: 'Base64 Encoder / Decoder', category: 'text-developer-tools', slug: 'base64-encoder-decoder', accept: '*/*', mode: 'text-or-file', actionLabel: 'Process Base64', popular: true, optionType: 'text-mode', lazyGroup: 'text', description: 'Encode or decode text and files to Base64 locally in your browser.' },
  { id: 188, name: 'URL Encoder / Decoder', category: 'text-developer-tools', slug: 'url-encoder-decoder', accept: '.txt', mode: 'text-or-file', actionLabel: 'Process URL', optionType: 'text-mode', lazyGroup: 'text' },
  { id: 189, name: 'SQL Formatter', category: 'text-developer-tools', accept: '.sql,.txt', mode: 'text-or-file', actionLabel: 'Format SQL', lazyGroup: 'text' },
  {
    id: 190,
    name: 'Regex Tester',
    category: 'text-developer-tools',
    accept: '.txt',
    mode: 'text-or-file',
    actionLabel: 'Test Regex',
    optionType: 'regex',
    lazyGroup: 'text',
    previewKind: 'regex',
    description: 'Test regular expressions with live match highlights, flags, and capture group inspection in your browser.',
  },
  {
    id: 201,
    name: 'HTML Preview',
    category: 'text-developer-tools',
    accept: '.html,.htm,.txt',
    mode: 'text-or-file',
    actionLabel: 'Download HTML',
    lazyGroup: 'text',
    previewKind: 'html',
    description: 'Write or paste HTML code, see a live sandboxed iframe preview below, and download your .html file locally.',
  },
  {
    id: 202,
    name: 'CSS Preview',
    category: 'text-developer-tools',
    accept: '.css,.txt',
    mode: 'text-or-file',
    actionLabel: 'Download CSS',
    lazyGroup: 'text',
    previewKind: 'css',
    description: 'Paste CSS rules and preview them live on sample headings, paragraphs, buttons, and cards before downloading .css.',
  },
  {
    id: 203,
    name: 'JavaScript Runner',
    category: 'text-developer-tools',
    accept: '.js,.mjs,.txt',
    mode: 'text-or-file',
    actionLabel: 'Run JavaScript',
    lazyGroup: 'text',
    previewKind: 'javascript',
    description: 'Run JavaScript snippets directly in your browser with instant console output preview and .js file download.',
  },
  {
    id: 204,
    name: 'Python Runner',
    category: 'text-developer-tools',
    accept: '.py,.txt',
    mode: 'text-or-file',
    actionLabel: 'Run Python',
    lazyGroup: 'text',
    previewKind: 'python',
    description: 'Execute Python code right inside your browser with live stdout output preview and .py file download.',
  },
  {
    id: 205,
    name: 'JSON Viewer',
    category: 'text-developer-tools',
    accept: '.json,.txt,application/json',
    mode: 'text-or-file',
    actionLabel: 'Download JSON',
    lazyGroup: 'text',
    previewKind: 'json-tree',
    description: 'Inspect JSON in an interactive collapsible tree with instant syntax error validation and .json export.',
  },
  {
    id: 206,
    name: 'Markdown Preview',
    category: 'text-developer-tools',
    accept: '.md,.markdown,.txt',
    mode: 'text-or-file',
    actionLabel: 'Download Markdown',
    lazyGroup: 'text',
    previewKind: 'markdown',
    description: 'Edit Markdown on the left, view live rendered HTML on the right, and download as .md or .html locally.',
  },
  {
    id: 207,
    name: 'XML Viewer',
    category: 'text-developer-tools',
    accept: '.xml,.svg,.txt',
    mode: 'text-or-file',
    actionLabel: 'Download XML',
    lazyGroup: 'text',
    previewKind: 'xml-tree',
    description: 'Parse and inspect XML documents in a collapsible tree view with error checks and .xml download.',
  },
  {
    id: 208,
    name: 'SQL Formatter & Preview',
    slug: 'sql-formatter-preview',
    category: 'text-developer-tools',
    accept: '.sql,.txt',
    mode: 'text-or-file',
    actionLabel: 'Download SQL',
    lazyGroup: 'text',
    previewKind: 'sql',
    description: 'Paste raw SQL queries, preview clean indented formatting in real time, and download your .sql file.',
  },
  {
    id: 209,
    name: 'Text Diff',
    slug: 'text-diff',
    category: 'text-developer-tools',
    accept: '.txt,.md,.json,.csv,.log',
    mode: 'text-or-file',
    actionLabel: 'Download Diff',
    lazyGroup: 'text',
    previewKind: 'diff',
    description: 'Compare original and modified text or code line by line with live color-coded diff preview and .diff export.',
  },

  // 10. FILE UTILITIES (10)
  { id: 191, name: 'File Size Converter', category: 'file-utilities', accept: '*/*', mode: 'text-or-file', actionLabel: 'Convert Size', optionType: 'size-unit', lazyGroup: 'utility', description: 'Convert between Bytes, KB, MB, GB, TB, KiB, MiB, and GiB or measure any file.' },
  { id: 192, name: 'File Type Detector', category: 'file-utilities', accept: '*/*', mode: 'browser', actionLabel: 'Detect File Type', lazyGroup: 'utility', description: 'Inspect file magic bytes (signatures) locally to identify the true format.' },
  { id: 193, name: 'File Extension Checker', category: 'file-utilities', accept: '*/*', mode: 'browser', actionLabel: 'Check Extension', lazyGroup: 'utility' },
  { id: 194, name: 'File Metadata Viewer', category: 'file-utilities', accept: '*/*', mode: 'browser', actionLabel: 'View Metadata', lazyGroup: 'utility' },
  { id: 195, name: 'SHA-256 Generator', category: 'file-utilities', accept: '*/*', mode: 'text-or-file', actionLabel: 'Generate SHA-256', popular: true, lazyGroup: 'utility', description: 'Compute cryptographic SHA-256 checksums for files or text via Web Crypto API.' },
  { id: 196, name: 'MD5 Generator', category: 'file-utilities', accept: '*/*', mode: 'text-or-file', actionLabel: 'Generate MD5', lazyGroup: 'utility', description: 'Compute RFC 1321 MD5 checksums for files or text 100% locally in your browser.' },
  { id: 197, name: 'SHA-512 Generator', category: 'file-utilities', accept: '*/*', mode: 'text-or-file', actionLabel: 'Generate SHA-512', lazyGroup: 'utility', description: 'Compute SHA-512 hashes locally using your browser’s SubtleCrypto engine.' },
  { id: 198, name: 'Duplicate File Checker', category: 'file-utilities', accept: '*/*', multiple: true, mode: 'browser', actionLabel: 'Check Duplicates', lazyGroup: 'utility', description: 'Compare multiple files by SHA-256 content hash to spot exact duplicates locally.' },
  { id: 199, name: 'File Splitter', category: 'file-utilities', accept: '*/*', mode: 'browser', actionLabel: 'Split File', optionType: 'split-size', lazyGroup: 'utility' },
  { id: 200, name: 'File Merger', category: 'file-utilities', accept: '*/*', multiple: true, mode: 'browser', actionLabel: 'Merge Files', lazyGroup: 'utility' },
];

export const TOOLS: ToolItem[] = RAW_TOOLS.map((seed) => {
  const cat = CATEGORY_MAP.get(seed.category);
  if (!cat) {
    throw new Error(`Unknown category: ${seed.category}`);
  }
  const slug = seed.slug ?? slugifyToolName(seed.name);
  const mode: ToolSupportMode = seed.mode ?? 'coming-soon';
  const description =
    seed.description ??
    `Process ${seed.name} tasks safely inside your browser. Fast, free, and 100% private—your file never leaves your device.`;

  return {
    id: seed.id,
    name: seed.name,
    slug,
    category: seed.category,
    categoryName: cat.name,
    description,
    icon: cat.icon,
    accept: seed.accept ?? DEFAULT_ACCEPT[seed.category],
    multiple: seed.multiple ?? false,
    mode,
    actionLabel: mode === 'coming-soon' ? 'Coming Soon' : (seed.actionLabel ?? 'Convert / Process'),
    popular: Boolean(seed.popular),
    optionType: seed.optionType,
    lazyGroup: seed.lazyGroup,
    previewKind: seed.previewKind,
  };
});

export const POPULAR_TOOLS: ToolItem[] = TOOLS.filter((tool) => tool.popular);

export function getCategoryBySlug(slug: string): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getToolBySlug(slug: string): ToolItem | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(categorySlug: CategorySlug): ToolItem[] {
  return TOOLS.filter((t) => t.category === categorySlug);
}

export function searchTools(query: string, limit?: number): ToolItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return limit ? TOOLS.slice(0, limit) : TOOLS;
  }
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const scored = TOOLS.map((tool) => {
    const nameLower = tool.name.toLowerCase();
    const catLower = tool.categoryName.toLowerCase();
    const descLower = tool.description.toLowerCase();
    const matchesAll = tokens.every(
      (tok) => nameLower.includes(tok) || catLower.includes(tok) || descLower.includes(tok)
    );
    if (!matchesAll) return null;
    let score = 0;
    if (nameLower === normalized) score += 100;
    else if (nameLower.startsWith(normalized)) score += 50;
    else if (nameLower.includes(normalized)) score += 25;
    if (tool.mode !== 'coming-soon') score += 5;
    if (tool.popular) score += 3;
    return { tool, score };
  }).filter((item): item is { tool: ToolItem; score: number } => item !== null);

  scored.sort((a, b) => b.score - a.score || a.tool.id - b.tool.id);
  const results = scored.map((s) => s.tool);
  return limit ? results.slice(0, limit) : results;
}
