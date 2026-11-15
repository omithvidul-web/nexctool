export type ChartKind = 'bar' | 'line' | 'pie';

export interface ParsedChartDataset {
  labels: string[];
  series: { name: string; values: number[] }[];
}

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'];

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseChartInput(raw: string): ParsedChartDataset {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Paste CSV or JSON array data to build a chart.');
  }

  // Try JSON array first
  if (trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON syntax.');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('JSON must be a non-empty array of objects.');
    }
    const rows = parsed.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object');
    if (rows.length === 0) {
      throw new Error('JSON array elements must be objects.');
    }
    const keys = Object.keys(rows[0]);
    if (keys.length < 2) {
      throw new Error('Each row needs at least 1 label field and 1 numeric value field.');
    }

    const labelKey = keys.find((k) => typeof rows[0][k] === 'string') ?? keys[0];
    const numericKeys = keys.filter(
      (k) => k !== labelKey && rows.some((r) => typeof r[k] === 'number' || (!Number.isNaN(Number(r[k])) && String(r[k]).trim() !== ''))
    );
    if (numericKeys.length === 0) {
      throw new Error('No numeric columns found to plot.');
    }

    return {
      labels: rows.map((r, i) => String(r[labelKey] ?? `Item ${i + 1}`)),
      series: numericKeys.map((k) => ({
        name: k,
        values: rows.map((r) => {
          const n = Number(r[k]);
          return Number.isFinite(n) ? n : 0;
        }),
      })),
    };
  }

  // CSV parsing
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }
  const headers = parseCsvRow(lines[0]);
  if (headers.length < 2) {
    throw new Error('CSV needs at least 2 columns (Category, Value).');
  }

  const dataRows = lines.slice(1).map(parseCsvRow);
  const labels = dataRows.map((r, i) => r[0] || `Row ${i + 1}`);
  const series = headers.slice(1).map((name, sIdx) => ({
    name: name || `Series ${sIdx + 1}`,
    values: dataRows.map((r) => {
      const n = Number(r[sIdx + 1]);
      return Number.isFinite(n) ? n : 0;
    }),
  }));

  return { labels, series };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildChartSvg(
  dataset: ParsedChartDataset,
  kind: ChartKind,
  title: string,
  width = 880,
  height = 480
): string {
  const padTop = title.trim() ? 64 : 36;
  const padBottom = 64;
  const padLeft = 72;
  const padRight = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#FFFFFF" rx="16" />`,
  ];

  if (title.trim()) {
    parts.push(
      `<text x="${width / 2}" y="36" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="700" fill="#0F172A">${escapeXml(title)}</text>`
    );
  }

  if (kind === 'pie') {
    const primary = dataset.series[0];
    const total = primary.values.reduce((acc, v) => acc + Math.max(0, v), 0) || 1;
    const cx = Math.round(width * 0.36);
    const cy = Math.round(padTop + plotH / 2);
    const radius = Math.min(plotW * 0.32, plotH * 0.44);

    let startAngle = -Math.PI / 2;
    dataset.labels.forEach((label, idx) => {
      const val = Math.max(0, primary.values[idx] ?? 0);
      const sliceAngle = (val / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const color = CHART_COLORS[idx % CHART_COLORS.length];

      if (sliceAngle >= Math.PI * 1.999) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" />`);
      } else if (sliceAngle > 0) {
        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);
        const largeArc = sliceAngle > Math.PI ? 1 : 0;
        parts.push(
          `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" stroke="#FFFFFF" stroke-width="2" />`
        );
      }

      const legendX = Math.round(width * 0.64);
      const legendY = padTop + 30 + idx * 28;
      if (legendY < height - 24) {
        const pct = ((val / total) * 100).toFixed(1);
        parts.push(`<rect x="${legendX}" y="${legendY - 11}" width="14" height="14" rx="4" fill="${color}" />`);
        parts.push(
          `<text x="${legendX + 22}" y="${legendY}" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#334155">${escapeXml(label)} (${val} · ${pct}%)</text>`
        );
      }

      startAngle = endAngle;
    });
  } else {
    const allVals = dataset.series.flatMap((s) => s.values);
    const rawMax = Math.max(1, ...allVals);
    const maxVal = rawMax * 1.12;

    // Horizontal grid lines & Y labels
    for (let step = 0; step <= 4; step++) {
      const val = (maxVal * step) / 4;
      const y = padTop + plotH - (step / 4) * plotH;
      parts.push(`<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1" />`);
      parts.push(
        `<text x="${padLeft - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="#64748B">${Math.round(val)}</text>`
      );
    }

    const groupCount = Math.max(1, dataset.labels.length);
    const groupW = plotW / groupCount;

    if (kind === 'bar') {
      const seriesCount = dataset.series.length;
      const innerPad = Math.max(6, groupW * 0.18);
      const barW = Math.max(6, (groupW - innerPad * 2) / seriesCount - 3);

      dataset.labels.forEach((label, i) => {
        const gx = padLeft + i * groupW + innerPad;
        dataset.series.forEach((s, sIdx) => {
          const v = Math.max(0, s.values[i] ?? 0);
          const bh = (v / maxVal) * plotH;
          const bx = gx + sIdx * (barW + 3);
          const by = padTop + plotH - bh;
          const color = CHART_COLORS[sIdx % CHART_COLORS.length];
          parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${color}" />`);
        });
        parts.push(
          `<text x="${(padLeft + i * groupW + groupW / 2).toFixed(1)}" y="${padTop + plotH + 22}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#475569">${escapeXml(label.slice(0, 14))}</text>`
        );
      });
    } else {
      // Line chart
      dataset.series.forEach((s, sIdx) => {
        const color = CHART_COLORS[sIdx % CHART_COLORS.length];
        const pts = dataset.labels.map((_, i) => {
          const x = padLeft + i * groupW + groupW / 2;
          const y = padTop + plotH - (Math.max(0, s.values[i] ?? 0) / maxVal) * plotH;
          return { x, y, val: s.values[i] ?? 0 };
        });
        const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        parts.push(`<polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${poly}" />`);
        pts.forEach((p) => {
          parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#FFFFFF" stroke="${color}" stroke-width="2.5" />`);
        });
      });

      dataset.labels.forEach((label, i) => {
        const x = padLeft + i * groupW + groupW / 2;
        parts.push(
          `<text x="${x.toFixed(1)}" y="${padTop + plotH + 22}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#475569">${escapeXml(label.slice(0, 14))}</text>`
        );
      });
    }

    // Series legend if multiple
    if (dataset.series.length > 1) {
      let lx = padLeft;
      dataset.series.forEach((s, idx) => {
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        parts.push(`<rect x="${lx}" y="${height - 22}" width="12" height="12" rx="3" fill="${color}" />`);
        parts.push(
          `<text x="${lx + 18}" y="${height - 12}" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#334155">${escapeXml(s.name)}</text>`
        );
        lx += Math.max(90, s.name.length * 8 + 36);
      });
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

export const SAMPLE_CHART_CSV = `Month,Revenue,Expenses
Jan,4200,2600
Feb,5100,2800
Mar,6300,3100
Apr,5800,2950
May,7400,3400
Jun,8900,3750`;
