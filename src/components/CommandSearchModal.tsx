import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Command, Search, Star, X } from 'lucide-react';
import { POPULAR_TOOLS, TOOLS, getToolBySlug, searchTools, type ToolItem } from '../data/tools';
import { getPinnedSlugs, getRecentSlugs, PREFS_CHANGED_EVENT } from '../utils/toolPreferences';
import { CategoryIcon, getCategoryIconColorClass } from './CategoryIcon';

export const OPEN_COMMAND_SEARCH_EVENT = 'nexctool:open-command-search';

export function openCommandSearch(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_SEARCH_EVENT));
  }
}

export function CommandSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinnedSlugs, setPinnedSlugs] = useState<string[]>(() => getPinnedSlugs());
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() => getRecentSlugs());
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const syncPrefs = () => {
      setPinnedSlugs(getPinnedSlugs());
      setRecentSlugs(getRecentSlugs());
    };
    window.addEventListener(PREFS_CHANGED_EVENT, syncPrefs);
    window.addEventListener('storage', syncPrefs);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, syncPrefs);
      window.removeEventListener('storage', syncPrefs);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const handleOpenEvent = () => setOpen(true);

    document.addEventListener('keydown', handleGlobalKey);
    window.addEventListener(OPEN_COMMAND_SEARCH_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener('keydown', handleGlobalKey);
      window.removeEventListener(OPEN_COMMAND_SEARCH_EVENT, handleOpenEvent);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setPinnedSlugs(getPinnedSlugs());
      setRecentSlugs(getRecentSlugs());
      const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const items = useMemo<{ list: ToolItem[]; heading: string; kind: 'search' | 'saved' | 'popular' }>(() => {
    const trimmed = query.trim();
    if (trimmed) {
      return { list: searchTools(trimmed, 12), heading: 'Matching Tools', kind: 'search' };
    }
    const savedSlugs = Array.from(new Set([...pinnedSlugs, ...recentSlugs]));
    const savedTools = savedSlugs
      .map((s) => getToolBySlug(s))
      .filter((t): t is ToolItem => Boolean(t))
      .slice(0, 8);
    if (savedTools.length > 0) {
      return { list: savedTools, heading: 'Pinned & Recent Tools', kind: 'saved' };
    }
    return { list: POPULAR_TOOLS.slice(0, 8), heading: 'Popular Browser Tools', kind: 'popular' };
  }, [query, pinnedSlugs, recentSlugs]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items.list.length]);

  if (!open) return null;

  const selectTool = (slug: string) => {
    setOpen(false);
    navigate(`/tools/${slug}`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (items.list.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % items.list.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + items.list.length) % items.list.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items.list[activeIndex] ?? items.list[0];
      if (target) selectTool(target.slug);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick tool command search"
      data-testid="command-search-modal"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-slate-950/55 dark:bg-black/75 backdrop-blur-xs"
      />

      {/* Palette Window */}
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700/80 rounded-[22px] shadow-2xl shadow-slate-950/25 dark:shadow-black/70 overflow-hidden">
        {/* Search Input Row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <Search className="w-5 h-5 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={`Search all ${TOOLS.length} tools (e.g. compress, merge pdf, zip, md5)...`}
            aria-label="Search tools"
            data-testid="command-search-input"
            className="w-full text-sm sm:text-base bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command search"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto p-2">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>{items.heading}</span>
            <span>{items.list.length} shown</span>
          </div>

          {items.list.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No tools found matching "{query}".
            </div>
          ) : (
            <ul role="listbox" className="space-y-0.5">
              {items.list.map((tool, index) => {
                const isSelected = index === activeIndex;
                const isPinned = pinnedSlugs.includes(tool.slug);
                const isRecent = !isPinned && recentSlugs.includes(tool.slug);
                return (
                  <li key={tool.slug} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => selectTool(tool.slug)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-slate-900 dark:text-white'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getCategoryIconColorClass(
                            tool.category
                          )}`}
                        >
                          <CategoryIcon icon={tool.icon} className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold truncate">{tool.name}</span>
                            {isPinned && (
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" aria-label="Pinned" />
                            )}
                            {isRecent && (
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="Recent" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {tool.categoryName} · {tool.mode === 'coming-soon' ? 'Coming Soon' : 'Runs in browser'}
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected ? 'text-[#4F46E5] dark:text-indigo-400 translate-x-0.5' : 'text-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">
                ↵
              </kbd>{' '}
              Open tool
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-medium">
            <Command className="w-3 h-3" aria-hidden="true" />K anytime
          </span>
        </div>
      </div>
    </div>
  );
}
