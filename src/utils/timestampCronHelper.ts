export interface TimestampConversion {
  milliseconds: number;
  seconds: number;
  isoUtc: string;
  utcReadable: string;
  localReadable: string;
  relativeText: string;
}

export function convertUnixTimestamp(rawValue: string | number, nowMs = Date.now()): TimestampConversion {
  const num = typeof rawValue === 'number' ? rawValue : Number(String(rawValue).trim());
  if (!Number.isFinite(num)) {
    throw new Error('Enter a valid numeric Unix timestamp.');
  }
  // Auto-detect seconds (< 1e12) vs milliseconds (>= 1e12)
  const ms = Math.abs(num) < 1e12 ? Math.round(num * 1000) : Math.round(num);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Timestamp is out of valid Date range.');
  }

  const diffSec = Math.round((ms - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  let rel = 'just now';
  if (absSec >= 86400) {
    const days = Math.round(absSec / 86400);
    rel = diffSec >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (absSec >= 3600) {
    const hrs = Math.round(absSec / 3600);
    rel = diffSec >= 0 ? `in ${hrs} hour${hrs === 1 ? '' : 's'}` : `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  } else if (absSec >= 60) {
    const mins = Math.round(absSec / 60);
    rel = diffSec >= 0 ? `in ${mins} min` : `${mins} min ago`;
  } else if (absSec > 0) {
    rel = diffSec >= 0 ? `in ${absSec} sec` : `${absSec} sec ago`;
  }

  return {
    milliseconds: ms,
    seconds: Math.floor(ms / 1000),
    isoUtc: d.toISOString(),
    utcReadable: d.toUTCString(),
    localReadable: d.toLocaleString(),
    relativeText: rel,
  };
}

const MONTH_ALIASES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DOW_ALIASES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseCronToken(token: string, min: number, max: number, aliases?: Record<string, number>): number {
  const lower = token.trim().toLowerCase();
  if (aliases && lower in aliases) return aliases[lower];
  const n = Number(lower);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Invalid cron value "${token}" (expected ${min}-${max}).`);
  }
  return n;
}

export function expandCronField(
  expr: string,
  min: number,
  max: number,
  aliases?: Record<string, number>
): Set<number> {
  const out = new Set<number>();
  const parts = expr.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('Empty cron field.');

  for (const part of parts) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart !== undefined ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid step value in "${part}".`);
    }

    if (rangePart === '*') {
      for (let v = min; v <= max; v += step) out.add(v);
    } else if (rangePart.includes('-')) {
      const [startStr, endStr] = rangePart.split('-');
      const start = parseCronToken(startStr, min, max, aliases);
      const end = parseCronToken(endStr, min, max, aliases);
      if (end < start) throw new Error(`Invalid cron range "${part}".`);
      for (let v = start; v <= end; v += step) out.add(v);
    } else {
      const single = parseCronToken(rangePart, min, max, aliases);
      if (stepPart !== undefined) {
        for (let v = single; v <= max; v += step) out.add(v);
      } else {
        out.add(single);
      }
    }
  }
  return out;
}

export interface CronExplanation {
  summary: string;
  fieldBreakdown: {
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
  };
  nextRunsUtc: string[];
}

function describeField(expr: string, unit: string, names?: string[]): string {
  if (expr === '*') return `Every ${unit}`;
  if (expr.startsWith('*/')) return `Every ${expr.slice(2)} ${unit}s`;
  if (names) {
    const vals = expr.split(',').map((p) => {
      const n = Number(p);
      return Number.isInteger(n) && names[n] ? names[n] : p;
    });
    return vals.join(', ');
  }
  return expr;
}

export function explainAndComputeCron(expression: string, fromDate = new Date(), count = 5): CronExplanation {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error('Standard cron expression must have exactly 5 space-separated fields (min hour day month weekday).');
  }

  const [fMin, fHour, fDom, fMonth, fDow] = fields;
  const mins = expandCronField(fMin, 0, 59);
  const hours = expandCronField(fHour, 0, 23);
  const doms = expandCronField(fDom, 1, 31);
  const months = expandCronField(fMonth, 1, 12, MONTH_ALIASES);
  const dowsRaw = expandCronField(fDow, 0, 7, DOW_ALIASES);
  const dows = new Set(Array.from(dowsRaw, (d) => (d === 7 ? 0 : d)));

  // Build readable sentence
  let timeText = '';
  if (fMin === '*' && fHour === '*') timeText = 'Every minute';
  else if (fMin.startsWith('*/') && fHour === '*') timeText = `Every ${fMin.slice(2)} minutes`;
  else if (fMin === '0' && fHour.startsWith('*/')) timeText = `Every ${fHour.slice(2)} hours at minute 00`;
  else if (!fMin.includes('*') && !fMin.includes('/') && !fHour.includes('*') && !fHour.includes('/')) {
    const hh = String(Array.from(hours)[0]).padStart(2, '0');
    const mm = String(Array.from(mins)[0]).padStart(2, '0');
    timeText = `At ${hh}:${mm} UTC`;
  } else {
    timeText = `Minute (${fMin}), Hour (${fHour}) UTC`;
  }

  const extras: string[] = [];
  if (fDom !== '*') extras.push(`on day ${fDom} of month`);
  if (fMonth !== '*') extras.push(`in ${describeField(fMonth, 'month', MONTH_NAMES)}`);
  if (fDow !== '*') {
    extras.push(`on ${Array.from(dows).sort().map((d) => DOW_NAMES[d]).join(', ')}`);
  }
  const summary = extras.length > 0 ? `${timeText}, ${extras.join(' ')}` : timeText;

  // Compute next N occurrences (scan forward up to 366 days max)
  const nextRunsUtc: string[] = [];
  const cursor = new Date(fromDate.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  const maxSteps = 527_040; // 366 days in minutes
  for (let step = 0; step < maxSteps && nextRunsUtc.length < count; step++) {
    const m = cursor.getUTCMinutes();
    const h = cursor.getUTCHours();
    const dom = cursor.getUTCDate();
    const mon = cursor.getUTCMonth() + 1;
    const dow = cursor.getUTCDay();

    if (mins.has(m) && hours.has(h) && months.has(mon)) {
      const domMatches = fDom === '*' || doms.has(dom);
      const dowMatches = fDow === '*' || dows.has(dow);
      const dayMatches = fDom !== '*' && fDow !== '*' ? domMatches || dowMatches : domMatches && dowMatches;
      if (dayMatches) {
        nextRunsUtc.push(cursor.toISOString().replace('.000Z', ' UTC').replace('T', ' '));
      }
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return {
    summary,
    fieldBreakdown: {
      minute: describeField(fMin, 'minute'),
      hour: describeField(fHour, 'hour'),
      dayOfMonth: describeField(fDom, 'day'),
      month: describeField(fMonth, 'month', MONTH_NAMES),
      dayOfWeek: describeField(fDow, 'weekday', DOW_NAMES),
    },
    nextRunsUtc,
  };
}
