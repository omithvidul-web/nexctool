const PINNED_KEY = 'nexctool-pinned-tools';
const RECENT_KEY = 'nexctool-recent-tools';
export const PREFS_CHANGED_EVENT = 'nexctool:prefs-changed';

export function parseStoredSlugs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim() && !seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function togglePinnedSlug(pinned: string[], slug: string, maxPinned = 8): string[] {
  const clean = slug.trim();
  if (!clean) return pinned;
  if (pinned.includes(clean)) {
    return pinned.filter((item) => item !== clean);
  }
  return [clean, ...pinned].slice(0, maxPinned);
}

export function recordRecentSlug(recent: string[], slug: string, maxRecent = 6): string[] {
  const clean = slug.trim();
  if (!clean) return recent;
  const filtered = recent.filter((item) => item !== clean);
  return [clean, ...filtered].slice(0, maxRecent);
}

export function getPinnedSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseStoredSlugs(window.localStorage.getItem(PINNED_KEY));
  } catch {
    return [];
  }
}

export function getRecentSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseStoredSlugs(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

export function isToolPinned(slug: string): boolean {
  return getPinnedSlugs().includes(slug);
}

function notifyPrefsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
  }
}

export function togglePinnedTool(slug: string): { pinned: string[]; isPinned: boolean } {
  const current = getPinnedSlugs();
  const next = togglePinnedSlug(current, slug);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      notifyPrefsChanged();
    } catch {
      // Ignore storage quota errors cleanly
    }
  }
  return { pinned: next, isPinned: next.includes(slug) };
}

export function recordRecentTool(slug: string): string[] {
  const current = getRecentSlugs();
  const next = recordRecentSlug(current, slug);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      notifyPrefsChanged();
    } catch {
      // Ignore storage quota errors cleanly
    }
  }
  return next;
}
