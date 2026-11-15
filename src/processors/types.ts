export interface ProcessOptions {
  quality?: number; // 10 - 100
  backgroundColor?: string; // hex e.g. #FFFFFF
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  rotation?: 90 | 180 | 270;
  indent?: 2 | 4 | 0; // 0 = minify
  textMode?: 'encode' | 'decode';
  regexPattern?: string;
  regexFlags?: string;
  splitSizeKb?: number;
  sizeValue?: number;
  sizeUnit?: 'B' | 'KB' | 'MB' | 'GB' | 'TB';
  cropAspect?: '1:1' | '16:9' | '4:3' | '9:16' | '3:2';
  watermarkText?: string;
  watermarkOpacity?: number; // 10 - 100
  watermarkPosition?: 'center' | 'bottom-right' | 'tile';
  targetFormat?: 'png' | 'jpg' | 'webp';
  pageRange?: string;
  pdfTitle?: string;
  pdfAuthor?: string;
  pdfSubject?: string;
  csvSplitRows?: number;
  tolerance?: number;
  signatureText?: string;
  formValues?: string;
  trimStartSec?: number;
  trimEndSec?: number;
  volumePercent?: number;
  speedFactor?: number;
  audioTitle?: string;
  audioArtist?: string;
  audioAlbum?: string;
  archiveTarget?: 'zip' | 'tar' | 'gz';
  documentWatermark?: string;
  pdfUserPassword?: string;
  ocrLang?: string;
  archivePassword?: string;
}

export interface ProcessOutputFile {
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ProcessResult {
  files?: ProcessOutputFile[];
  textOutput?: string;
  outputFilename?: string;
  outputMimeType?: string;
  previewDataUrl?: string;
  summaryLines?: string[];
  originalTotalBytes?: number;
  outputTotalBytes?: number;
}
