export type CollageLayoutMode =
  | 'horizontal'
  | 'vertical'
  | 'grid-2x2'
  | 'grid-3x3'
  | 'before-after';

export interface CollageSourceSize {
  width: number;
  height: number;
}

export interface CollageTileRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollageLayoutResult {
  canvasWidth: number;
  canvasHeight: number;
  tiles: CollageTileRect[];
}

export function computeCollageLayout(
  sources: CollageSourceSize[],
  mode: CollageLayoutMode,
  targetWidth: number,
  gap: number,
  padding: number
): CollageLayoutResult {
  if (sources.length === 0) {
    return { canvasWidth: targetWidth, canvasHeight: Math.round(targetWidth * 0.6), tiles: [] };
  }

  const count = sources.length;
  const innerWidth = Math.max(100, targetWidth - padding * 2);

  if (mode === 'horizontal' || mode === 'before-after') {
    const activeCount = mode === 'before-after' ? Math.min(2, count) : count;
    const cellW = Math.floor((innerWidth - gap * Math.max(0, activeCount - 1)) / activeCount);
    // Use median aspect ratio capped neatly
    const avgRatio =
      sources
        .slice(0, activeCount)
        .reduce((sum, s) => sum + Math.max(0.4, Math.min(2.4, s.height / Math.max(1, s.width))), 0) /
      activeCount;
    const cellH = Math.max(120, Math.round(cellW * avgRatio));
    const tiles: CollageTileRect[] = [];
    for (let i = 0; i < activeCount; i++) {
      tiles.push({
        index: i,
        x: padding + i * (cellW + gap),
        y: padding,
        width: cellW,
        height: cellH,
      });
    }
    return {
      canvasWidth: padding * 2 + activeCount * cellW + Math.max(0, activeCount - 1) * gap,
      canvasHeight: padding * 2 + cellH,
      tiles,
    };
  }

  if (mode === 'vertical') {
    let cursorY = padding;
    const tiles: CollageTileRect[] = [];
    for (let i = 0; i < count; i++) {
      const s = sources[i];
      const ratio = s.height / Math.max(1, s.width);
      const h = Math.max(80, Math.round(innerWidth * Math.max(0.25, Math.min(2.5, ratio))));
      tiles.push({
        index: i,
        x: padding,
        y: cursorY,
        width: innerWidth,
        height: h,
      });
      cursorY += h + (i < count - 1 ? gap : 0);
    }
    return {
      canvasWidth: targetWidth,
      canvasHeight: cursorY + padding,
      tiles,
    };
  }

  const cols = mode === 'grid-3x3' ? 3 : 2;
  const rows = Math.ceil(count / cols);
  const cellW = Math.floor((innerWidth - gap * (cols - 1)) / cols);
  const cellH = Math.round(cellW * 0.8);
  const tiles: CollageTileRect[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    tiles.push({
      index: i,
      x: padding + col * (cellW + gap),
      y: padding + row * (cellH + gap),
      width: cellW,
      height: cellH,
    });
  }

  return {
    canvasWidth: padding * 2 + cols * cellW + (cols - 1) * gap,
    canvasHeight: padding * 2 + rows * cellH + Math.max(0, rows - 1) * gap,
    tiles,
  };
}
