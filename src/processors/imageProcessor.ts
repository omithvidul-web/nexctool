import type { ProcessOptions, ProcessOutputFile, ProcessResult } from './types';
import { calculateSavingsPercent, formatBytes, replaceExtension } from '../utils/formatters';
import { imageRgbaToSvg } from '../utils/gifEncoder';

function loadImageFromUrl(objectUrl: string, filename: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      reject(new Error(`Unable to decode image "${filename}". Please ensure it is a valid image file.`));
    };
    img.src = objectUrl;
  });
}

async function decodeFileToImageSource(file: File): Promise<{
  drawToCanvas: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  const lower = file.name.toLowerCase();

  // HEIC / HEIF decoding via heic2any
  if (lower.endsWith('.heic') || lower.endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif')) {
    const heicModule = await import('heic2any');
    const heic2any = heicModule.default ?? (heicModule as unknown as (opts: unknown) => Promise<Blob | Blob[]>);
    const converted = await heic2any({ blob: file, toType: 'image/png', quality: 0.95 });
    const pngBlob = Array.isArray(converted) ? converted[0] : converted;
    const url = URL.createObjectURL(pngBlob);
    try {
      const img = await loadImageFromUrl(url, file.name);
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        drawToCanvas: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(url),
      };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  // TIFF decoding via UTIF
  if (lower.endsWith('.tif') || lower.endsWith('.tiff') || file.type === 'image/tiff') {
    const utifMod = await import('utif');
    const UTIF = (utifMod.default ?? utifMod) as typeof import('utif');
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    if (!ifds || ifds.length === 0) {
      throw new Error(`Could not decode TIFF frames in "${file.name}".`);
    }
    UTIF.decodeImage(buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const w = ifds[0].width;
    const h = ifds[0].height;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    if (!octx) throw new Error('Canvas 2D context unavailable.');
    const imgData = new ImageData(new Uint8ClampedArray(rgba), w, h);
    octx.putImageData(imgData, 0, 0);
    return {
      width: w,
      height: h,
      drawToCanvas: (ctx, tw, th) => ctx.drawImage(offscreen, 0, 0, tw, th),
      cleanup: () => {},
    };
  }

  // Native browser-decodable formats (JPG, PNG, WebP, AVIF, GIF, BMP, SVG)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromUrl(objectUrl, file.name);
    const w = img.naturalWidth || img.width || 800;
    const h = img.naturalHeight || img.height || 600;
    return {
      width: w,
      height: h,
      drawToCanvas: (ctx, tw, th) => ctx.drawImage(img, 0, 0, tw, th),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Browser failed to export the processed image.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function computeCenterCropRect(
  naturalWidth: number,
  naturalHeight: number,
  aspect: ProcessOptions['cropAspect']
): { sx: number; sy: number; sw: number; sh: number } {
  const ratioMap: Record<NonNullable<ProcessOptions['cropAspect']>, number> = {
    '1:1': 1,
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '9:16': 9 / 16,
    '3:2': 3 / 2,
  };
  const targetRatio = ratioMap[aspect ?? '1:1'] ?? 1;
  const sourceRatio = naturalWidth / naturalHeight;

  let sw = naturalWidth;
  let sh = naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = Math.max(1, Math.round(naturalHeight * targetRatio));
  } else {
    sh = Math.max(1, Math.round(naturalWidth / targetRatio));
  }
  const sx = Math.max(0, Math.floor((naturalWidth - sw) / 2));
  const sy = Math.max(0, Math.floor((naturalHeight - sh) / 2));
  return { sx, sy, sw, sh };
}

function removeBackgroundByBorderSample(canvas: HTMLCanvasElement, tolerance: number): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Sample 4 corners to estimate background color
  const cornerCoords = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (const [cx, cy] of cornerCoords) {
    const idx = (cy * width + cx) * 4;
    rSum += data[idx];
    gSum += data[idx + 1];
    bSum += data[idx + 2];
  }
  const bgR = rSum / 4;
  const bgG = gSum / 4;
  const bgB = bSum / 4;
  const maxDist = Math.max(8, tolerance) * 1.75;

  // Flood-fill from outer border pixels so interior matching colors stay safe
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let cleared = 0;

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const off = p * 4;
    const dr = data[off] - bgR;
    const dg = data[off + 1] - bgG;
    const db = data[off + 2] - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= maxDist) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    data[p * 4 + 3] = 0;
    cleared++;
    const x = p % width;
    const y = (p - x) / width;
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  ctx.putImageData(imgData, 0, 0);
  return cleared;
}

function drawImageWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  opacityPct: number,
  position: ProcessOptions['watermarkPosition']
): void {
  const cleanText = text.trim() || 'NexcTool';
  const alpha = Math.min(1, Math.max(0.1, opacityPct / 100));
  const baseFont = Math.max(18, Math.round(Math.min(width, height) * 0.065));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${baseFont}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = Math.max(2, Math.round(baseFont * 0.08));

  if (position === 'tile') {
    const smallFont = Math.max(16, Math.round(baseFont * 0.72));
    ctx.font = `700 ${smallFont}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stepX = Math.max(160, Math.round(width / 3));
    const stepY = Math.max(120, Math.round(height / 3));
    for (let y = stepY / 2; y < height; y += stepY) {
      for (let x = stepX / 2; x < width; x += stepX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 6);
        ctx.strokeText(cleanText, 0, 0);
        ctx.fillText(cleanText, 0, 0);
        ctx.restore();
      }
    }
  } else if (position === 'bottom-right') {
    const pad = Math.max(16, Math.round(Math.min(width, height) * 0.04));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.strokeText(cleanText, width - pad, height - pad);
    ctx.fillText(cleanText, width - pad, height - pad);
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 10);
    ctx.strokeText(cleanText, 0, 0);
    ctx.fillText(cleanText, 0, 0);
  }

  ctx.restore();
}

function resolvePreserveFormat(file: File, qualityPercent?: number): {
  outputMime: string;
  outputExt: string;
  qualityArg?: number;
  fillBg?: string;
} {
  const q = Math.min(1, Math.max(0.1, (qualityPercent ?? 92) / 100));
  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
    return { outputMime: 'image/jpeg', outputExt: 'jpg', qualityArg: q, fillBg: '#FFFFFF' };
  }
  if (file.type === 'image/webp' || /\.webp$/i.test(file.name)) {
    return { outputMime: 'image/webp', outputExt: 'webp', qualityArg: q };
  }
  return { outputMime: 'image/png', outputExt: 'png' };
}

export async function processImageTool(
  slug: string,
  files: File[],
  options: ProcessOptions
): Promise<ProcessResult> {
  if (files.length === 0) {
    throw new Error('Please select an image file first.');
  }

  if (slug === 'batch-image-converter') {
    const targetFmt = options.targetFormat ?? 'webp';
    const qualityArg = Math.min(1, Math.max(0.1, (options.quality ?? 85) / 100));
    const outputMime =
      targetFmt === 'jpg' ? 'image/jpeg' : targetFmt === 'webp' ? 'image/webp' : 'image/png';
    const outputExt = targetFmt;

    const outputFiles: ProcessOutputFile[] = [];
    let firstPreview: string | undefined;
    let totalOriginal = 0;
    let totalOutput = 0;

    for (const file of files) {
      totalOriginal += file.size;
      const src = await decodeFileToImageSource(file);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = src.width;
        canvas.height = src.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context is not available in this browser.');
        if (targetFmt === 'jpg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, src.width, src.height);
        }
        src.drawToCanvas(ctx, src.width, src.height);

        const blob = await canvasToBlob(canvas, outputMime, targetFmt === 'png' ? undefined : qualityArg);
        if (!firstPreview) {
          firstPreview = canvas.toDataURL(outputMime, targetFmt === 'png' ? undefined : qualityArg);
        }
        const filename = replaceExtension(file.name, outputExt);
        totalOutput += blob.size;
        outputFiles.push({ blob, filename, mimeType: outputMime, size: blob.size });
      } finally {
        src.cleanup();
      }
    }

    const savedPct = calculateSavingsPercent(totalOriginal, totalOutput);
    return {
      files: outputFiles,
      outputFilename: outputFiles[0]?.filename,
      outputMimeType: outputMime,
      previewDataUrl: firstPreview,
      summaryLines: [
        `Converted ${outputFiles.length} image(s) to ${outputExt.toUpperCase()}`,
        `Total size: ${formatBytes(totalOriginal)} → ${formatBytes(totalOutput)}${savedPct > 0 ? ` (${savedPct}% smaller)` : ''}`,
      ],
      originalTotalBytes: totalOriginal,
      outputTotalBytes: totalOutput,
    };
  }

  const file = files[0];
  const src = await decodeFileToImageSource(file);
  try {
    const naturalWidth = src.width;
    const naturalHeight = src.height;

    if (slug === 'png-to-svg') {
      const maxDim = 256;
      const scale = Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight));
      const w = Math.max(1, Math.round(naturalWidth * scale));
      const h = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      src.drawToCanvas(ctx, w, h);
      const rgba = ctx.getImageData(0, 0, w, h).data;
      const svgText = imageRgbaToSvg(rgba, w, h);
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const filename = replaceExtension(file.name, 'svg');
      const previewDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
      return {
        files: [{ blob, filename, mimeType: 'image/svg+xml', size: blob.size }],
        outputFilename: filename,
        outputMimeType: 'image/svg+xml',
        previewDataUrl,
        summaryLines: [
          `Vectorized raster image (${w}×${h}) into SVG vector paths`,
          `Output size: ${formatBytes(blob.size)}`,
        ],
        originalTotalBytes: file.size,
        outputTotalBytes: blob.size,
      };
    }

    let cropRect: { sx: number; sy: number; sw: number; sh: number } | null = null;
    let targetWidth = naturalWidth;
    let targetHeight = naturalHeight;

    if (slug === 'image-cropper') {
      cropRect = computeCenterCropRect(naturalWidth, naturalHeight, options.cropAspect);
      targetWidth = cropRect.sw;
      targetHeight = cropRect.sh;
    } else if (slug === 'image-resizer') {
      const reqW = options.width && options.width > 0 ? options.width : naturalWidth;
      const reqH = options.height && options.height > 0 ? options.height : naturalHeight;
      if (options.maintainAspectRatio !== false && options.width && !options.height) {
        targetWidth = reqW;
        targetHeight = Math.max(1, Math.round((naturalHeight / naturalWidth) * reqW));
      } else {
        targetWidth = reqW;
        targetHeight = reqH;
      }
    }

    const rotation = slug === 'image-rotator' ? (options.rotation ?? 90) : 0;
    const swapDims = rotation === 90 || rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swapDims ? targetHeight : targetWidth;
    canvas.height = swapDims ? targetWidth : targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available in this browser.');
    }

    let outputMime = 'image/png';
    let outputExt = 'png';
    let qualityArg: number | undefined;
    let fillBg: string | undefined;

    if (
      slug === 'jpg-to-png' ||
      slug === 'webp-to-png' ||
      slug === 'svg-to-png' ||
      slug === 'bmp-to-png' ||
      slug === 'gif-to-png' ||
      slug === 'avif-to-png' ||
      slug === 'heic-to-png' ||
      slug === 'tiff-to-png' ||
      slug === 'image-background-remover'
    ) {
      outputMime = 'image/png';
      outputExt = 'png';
    } else if (
      slug === 'png-to-jpg' ||
      slug === 'webp-to-jpg' ||
      slug === 'svg-to-jpg' ||
      slug === 'bmp-to-jpg' ||
      slug === 'avif-to-jpg' ||
      slug === 'heic-to-jpg' ||
      slug === 'tiff-to-jpg'
    ) {
      outputMime = 'image/jpeg';
      outputExt = 'jpg';
      qualityArg = Math.min(1, Math.max(0.1, (options.quality ?? 90) / 100));
      fillBg = options.backgroundColor || '#FFFFFF';
    } else if (slug === 'jpg-to-webp' || slug === 'png-to-webp' || slug === 'gif-to-webp') {
      outputMime = 'image/webp';
      outputExt = 'webp';
      qualityArg = Math.min(1, Math.max(0.1, (options.quality ?? 85) / 100));
    } else if (slug === 'image-compressor') {
      const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      if (isWebp || isPng) {
        outputMime = 'image/webp';
        outputExt = 'webp';
      } else {
        outputMime = 'image/jpeg';
        outputExt = 'jpg';
      }
      qualityArg = Math.min(0.95, Math.max(0.1, (options.quality ?? 70) / 100));
    } else {
      const preserved = resolvePreserveFormat(file);
      outputMime = preserved.outputMime;
      outputExt = preserved.outputExt;
      qualityArg = preserved.qualityArg;
      fillBg = preserved.fillBg;
    }

    if (fillBg) {
      ctx.fillStyle = fillBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.save();
    if (cropRect) {
      const temp = document.createElement('canvas');
      temp.width = naturalWidth;
      temp.height = naturalHeight;
      const tctx = temp.getContext('2d');
      if (!tctx) throw new Error('Canvas 2D context unavailable.');
      src.drawToCanvas(tctx, naturalWidth, naturalHeight);
      ctx.drawImage(temp, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, targetWidth, targetHeight);
    } else if (rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      src.drawToCanvas(ctx, targetWidth, targetHeight);
    } else {
      src.drawToCanvas(ctx, targetWidth, targetHeight);
    }
    ctx.restore();

    let extraSummary: string | null = null;
    if (slug === 'image-background-remover') {
      const removedPixels = removeBackgroundByBorderSample(canvas, options.tolerance ?? 32);
      const totalPixels = canvas.width * canvas.height;
      const pct = Math.round((removedPixels / Math.max(1, totalPixels)) * 100);
      extraSummary = `Removed uniform background (${pct}% transparent area, tolerance ${options.tolerance ?? 32})`;
    }

    if (slug === 'image-watermark') {
      drawImageWatermark(
        ctx,
        canvas.width,
        canvas.height,
        options.watermarkText ?? 'NexcTool',
        options.watermarkOpacity ?? 50,
        options.watermarkPosition ?? 'center'
      );
    }

    const blob = await canvasToBlob(canvas, outputMime, qualityArg);
    const filename =
      slug === 'image-compressor'
        ? replaceExtension(file.name, `compressed.${outputExt}`)
        : slug === 'image-cropper'
          ? replaceExtension(file.name, `cropped.${outputExt}`)
          : slug === 'image-watermark'
            ? replaceExtension(file.name, `watermarked.${outputExt}`)
            : slug === 'image-background-remover'
              ? replaceExtension(file.name, 'transparent.png')
              : replaceExtension(file.name, outputExt);

    const previewDataUrl = canvas.toDataURL(outputMime, qualityArg);
    const savedPct = calculateSavingsPercent(file.size, blob.size);
    const summaryLines = [
      `Dimensions: ${canvas.width} × ${canvas.height} px`,
      `Original size: ${formatBytes(file.size)} → Output size: ${formatBytes(blob.size)}${savedPct > 0 ? ` (${savedPct}% smaller)` : ''}`,
      ...(extraSummary ? [extraSummary] : []),
    ];

    return {
      files: [{ blob, filename, mimeType: outputMime, size: blob.size }],
      outputFilename: filename,
      outputMimeType: outputMime,
      previewDataUrl,
      summaryLines,
      originalTotalBytes: file.size,
      outputTotalBytes: blob.size,
    };
  } finally {
    src.cleanup();
  }
}
