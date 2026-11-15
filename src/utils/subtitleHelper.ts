export type SubtitleFormat = 'srt' | 'vtt' | 'txt';

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export function parseTimestampToMs(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
  } else {
    minutes = Number(parts[0]);
    seconds = Number(parts[1]);
  }

  if (![hours, minutes, seconds].every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function formatMsToTimestamp(ms: number, sep: ',' | '.' = ','): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(safe / 1000);
  const millis = safe % 1000;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  return `${hh}:${mm}:${ss}${sep}${mmm}`;
}

export function parseSubtitles(input: string): SubtitleCue[] {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    if (lines.length === 0) continue;
    if (lines[0].trim().startsWith('WEBVTT') || lines[0].trim().startsWith('NOTE')) {
      continue;
    }

    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const [rawStart, rawEndPart] = timeLine.split('-->');
    if (!rawStart || !rawEndPart) continue;
    const rawEnd = rawEndPart.trim().split(/\s+/)[0];

    const startMs = parseTimestampToMs(rawStart);
    const endMs = parseTimestampToMs(rawEnd);
    if (startMs === null || endMs === null) continue;

    const textLines = lines.slice(timeLineIdx + 1).join('\n').trim();
    cues.push({
      index: cues.length + 1,
      startMs,
      endMs: Math.max(startMs, endMs),
      text: textLines,
    });
  }

  return cues;
}

export function shiftSubtitleCues(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
  if (!Number.isFinite(offsetMs) || offsetMs === 0) return cues;
  return cues.map((cue, idx) => {
    const duration = Math.max(0, cue.endMs - cue.startMs);
    const nextStart = Math.max(0, Math.round(cue.startMs + offsetMs));
    const nextEnd = Math.max(nextStart, Math.round(cue.endMs + offsetMs));
    return {
      index: idx + 1,
      startMs: nextStart,
      endMs: offsetMs < 0 && cue.startMs + offsetMs < 0 ? Math.max(nextStart, duration) : nextEnd,
      text: cue.text,
    };
  });
}

export function formatSubtitles(
  cues: SubtitleCue[],
  format: SubtitleFormat,
  includeTimestampsInTxt = false
): string {
  if (cues.length === 0) return '';

  if (format === 'srt') {
    return cues
      .map(
        (c, i) =>
          `${i + 1}\n${formatMsToTimestamp(c.startMs, ',')} --> ${formatMsToTimestamp(c.endMs, ',')}\n${c.text}`
      )
      .join('\n\n');
  }

  if (format === 'vtt') {
    const body = cues
      .map(
        (c) =>
          `${formatMsToTimestamp(c.startMs, '.')} --> ${formatMsToTimestamp(c.endMs, '.')}\n${c.text}`
      )
      .join('\n\n');
    return `WEBVTT\n\n${body}`;
  }

  if (includeTimestampsInTxt) {
    return cues
      .map((c) => `[${formatMsToTimestamp(c.startMs, '.')}] ${c.text.replace(/\n/g, ' ')}`)
      .join('\n');
  }
  return cues.map((c) => c.text).join('\n\n');
}

export const SAMPLE_SRT_SUBTITLE = `1
00:00:01,000 --> 00:00:04,200
Welcome to NexcTool Subtitle Converter.

2
00:00:04,800 --> 00:00:08,500
Shift timing forward or backward and convert between SRT, VTT, and TXT locally.`;
