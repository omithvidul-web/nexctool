import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Search,
  Star,
  WifiOff,
  Zap,
} from 'lucide-react';
import { CATEGORIES, POPULAR_TOOLS, TOOLS, getToolBySlug, searchTools, type ToolItem } from '../data/tools';
import { CategoryIcon, getCategoryIconColorClass } from '../components/CategoryIcon';
import { CategoryCardImage } from '../components/CategoryCardImage';
import { SeoHead } from '../components/SeoHead';
import {
  PREFS_CHANGED_EVENT,
  getPinnedSlugs,
  getRecentSlugs,
  togglePinnedTool,
} from '../utils/toolPreferences';

export function HomePage() {
  const [heroQuery, setHeroQuery] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [pinnedSlugs, setPinnedSlugs] = useState<string[]>(() => getPinnedSlugs());
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() => getRecentSlugs());
  const carouselRef = useRef<HTMLDivElement>(null);
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

  const quickTools = useMemo(() => {
    const pinnedSet = new Set(pinnedSlugs);
    const pinned = pinnedSlugs
      .map((s) => getToolBySlug(s))
      .filter((t): t is ToolItem => Boolean(t));
    const recent = recentSlugs
      .filter((s) => !pinnedSet.has(s))
      .map((s) => getToolBySlug(s))
      .filter((t): t is ToolItem => Boolean(t));
    return { pinned, recent, all: [...pinned, ...recent].slice(0, 8) };
  }, [pinnedSlugs, recentSlugs]);

  const searchResults = useMemo(() => {
    if (!heroQuery.trim()) return [];
    return searchTools(heroQuery, 12);
  }, [heroQuery]);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      navigate(`/tools/${searchResults[0].slug}`);
    } else if (heroQuery.trim()) {
      navigate(`/all-tools?q=${encodeURIComponent(heroQuery.trim())}`);
    }
  };

  const scrollToSlide = (index: number) => {
    const clamped = Math.max(0, Math.min(CATEGORIES.length - 1, index));
    setActiveSlide(clamped);
    const el = carouselRef.current;
    if (!el) return;
    const cardStep = 208;
    el.scrollTo({ left: clamped * cardStep, behavior: 'smooth' });
  };

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const cardStep = 208;
    const idx = Math.round(el.scrollLeft / cardStep);
    const clamped = Math.max(0, Math.min(CATEGORIES.length - 1, idx));
    if (clamped !== activeSlide) {
      setActiveSlide(clamped);
    }
  };

  return (
    <>
      <SeoHead
        title="NexcTool - 200 Free Online File Tools | 100% Private"
        description="Convert, compress, and edit any file right inside your browser with 200 free online file tools. 100% private—your file never leaves your device."
      />

      {/* Premium Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-[#EEF2FF] via-[#F8FAFC] to-[#F8FAFC] dark:from-[#11162B] dark:via-[#0B101D] dark:to-[#090D16]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.16),_transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.22),_transparent_65%)]"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center animate-fade-up">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-indigo-200/80 dark:border-indigo-500/30 shadow-xs text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-7 backdrop-blur-sm">
            <Lock className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
            <span>100% Free • No Sign-up • Private</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-[62px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.08] mx-auto max-w-4xl"
            style={{ textWrap: 'balance' }}
          >
            <span className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
              Every Tool
            </span>{' '}
            You Need, In One Place
          </h1>

          <p className="mt-5 text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Convert, compress, and edit any file right inside your browser. Your file never leaves your device.
          </p>

          {/* Big Rounded Hero Search Bar */}
          <div className="mt-10 max-w-2xl mx-auto relative">
            <form onSubmit={handleHeroSearch} role="search" aria-label="Search any file tool">
              <label htmlFor="hero-tool-search" className="sr-only">
                Search 200+ tools
              </label>
              <div className="flex items-center bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-700/80 rounded-full p-2 shadow-xl shadow-indigo-950/8 dark:shadow-black/50 focus-within:border-[#4F46E5] dark:focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/15 transition-all duration-200">
                <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 ml-4 shrink-0" aria-hidden="true" />
                <input
                  id="hero-tool-search"
                  type="search"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Search 200+ tools..."
                  className="w-full h-12 px-3.5 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-transparent focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-7 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Find Tool
                </button>
              </div>
            </form>

            {/* Instant Search Results Panel */}
            {heroQuery.trim().length > 0 && (
              <div
                data-testid="hero-search-results"
                className="mt-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[20px] shadow-2xl shadow-slate-900/10 dark:shadow-black/60 text-left overflow-hidden z-20 relative"
              >
                {searchResults.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                    No tools matched "{heroQuery}". Try another keyword or{' '}
                    <Link to="/all-tools" className="text-[#4F46E5] dark:text-indigo-400 font-semibold hover:underline">
                      browse all {TOOLS.length} tools
                    </Link>
                    .
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                    {searchResults.map((tool) => (
                      <li key={tool.slug}>
                        <Link
                          to={`/tools/${tool.slug}`}
                          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getCategoryIconColorClass(
                                tool.category
                              )}`}
                            >
                              <CategoryIcon icon={tool.icon} className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {tool.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {tool.categoryName} · {tool.mode === 'coming-soon' ? 'Coming Soon' : 'Runs in browser'}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            <span>200+ Tools</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
            <span>0 Uploads</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
            <span>100% Free</span>
          </div>
        </div>
      </section>

      {/* Conditional Pinned & Recent Tools Strip */}
      {quickTools.all.length > 0 && (
        <section
          data-testid="pinned-recent-section"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-2"
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" aria-hidden="true" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Your Pinned & Recent Tools
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Saved privately on this device
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {quickTools.all.map((tool) => {
              const isPinned = pinnedSlugs.includes(tool.slug);
              return (
                <Link
                  key={tool.slug}
                  to={`/tools/${tool.slug}`}
                  className="group relative flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getCategoryIconColorClass(
                        tool.category
                      )}`}
                    >
                      <CategoryIcon icon={tool.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 truncate transition-colors">
                        {tool.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {isPinned ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">Pinned</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" /> Recent
                          </span>
                        )}
                        <span>·</span>
                        <span className="truncate">{tool.categoryName}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePinnedTool(tool.slug);
                    }}
                    aria-label={isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-colors cursor-pointer"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${isPinned ? 'text-amber-500 fill-amber-400' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 10 Category Cards: Desktop Grid + Mobile/Tablet Swipe Carousel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4 mb-9">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Browse by Category
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              10 organized suites covering {TOOLS.length} specialized file tools.
            </p>
          </div>
          <Link
            to="/all-tools"
            className="text-sm font-semibold text-[#4F46E5] dark:text-indigo-400 hover:text-[#4338CA] dark:hover:text-indigo-300 whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors"
          >
            <span>All {TOOLS.length} Tools</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {/* DESKTOP (Laptop): 5-column Grid */}
        <div
          data-testid="category-cards-grid"
          className="hidden lg:grid lg:grid-cols-5 gap-5"
        >
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              to={`/category/${category.slug}`}
              className="group flex flex-col bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:shadow-[0_14px_32px_-8px_rgba(79,70,229,0.22)] dark:hover:shadow-[0_14px_32px_-8px_rgba(99,102,241,0.3)] transition-all duration-200 ease-out"
            >
              <CategoryCardImage
                slug={category.slug}
                name={category.name}
                icon={category.icon}
                className="border-b border-slate-100 dark:border-slate-800/80"
              />

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 group-hover:bg-gradient-to-br group-hover:from-[#4F46E5] group-hover:to-[#7C3AED] group-hover:text-white flex items-center justify-center shrink-0 transition-all duration-200">
                      <CategoryIcon icon={category.icon} className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 transition-colors tracking-tight leading-snug">
                      {category.name}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {category.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 transition-colors">
                  <span className="tabular-nums">{category.expectedCount} Tools</span>
                  <ArrowRight
                    className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* MOBILE & TABLET: Horizontal Swipe Carousel */}
        <div className="lg:hidden relative">
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label="Previous category"
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md text-slate-700 dark:text-slate-200 hover:text-[#4F46E5] hover:border-[#4F46E5] disabled:opacity-40 disabled:cursor-not-allowed absolute -left-3 z-10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              data-testid="category-carousel"
              className="w-full flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar py-2 px-0.5"
            >
              {CATEGORIES.map((category, idx) => {
                const isActive = idx === activeSlide;
                return (
                  <Link
                    key={category.slug}
                    to={`/category/${category.slug}`}
                    className={`group w-[196px] shrink-0 snap-start bg-white dark:bg-[#111827] rounded-[20px] overflow-hidden shadow-sm flex flex-col border transition-all duration-200 hover:border-[#4F46E5] dark:hover:border-indigo-400 ${
                      isActive
                        ? 'border-[#4F46E5] dark:border-indigo-400 shadow-md shadow-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <CategoryCardImage
                      slug={category.slug}
                      name={category.name}
                      icon={category.icon}
                      className="border-b border-slate-100 dark:border-slate-800/80"
                    />

                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 group-hover:bg-gradient-to-br group-hover:from-[#4F46E5] group-hover:to-[#7C3AED] group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                          <CategoryIcon icon={category.icon} className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight line-clamp-2">
                          {category.name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="tabular-nums">{category.expectedCount} Tools</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide === CATEGORIES.length - 1}
              aria-label="Next category"
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md text-slate-700 dark:text-slate-200 hover:text-[#4F46E5] hover:border-[#4F46E5] disabled:opacity-40 disabled:cursor-not-allowed absolute -right-3 z-10 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Carousel Controls & Dots */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label="Slide categories left"
              className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div
              data-testid="category-carousel-dots"
              className="flex items-center justify-center gap-1.5"
              role="tablist"
              aria-label="Category slides"
            >
              {CATEGORIES.map((category, idx) => (
                <button
                  key={category.slug}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeSlide}
                  aria-label={`Show ${category.name}`}
                  onClick={() => scrollToSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-200 cursor-pointer ${
                    idx === activeSlide
                      ? 'w-5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]'
                      : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide === CATEGORIES.length - 1}
              aria-label="Slide categories right"
              className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Popular Tools (12 most used) */}
      <section className="bg-white/70 dark:bg-[#0D1322] border-y border-slate-200/80 dark:border-slate-800/80 py-16 sm:py-22">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Popular Tools
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Frequently used converters, compressors, and developer utilities ready right in your browser.
            </p>
          </div>

          <div
            data-testid="popular-tools-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {POPULAR_TOOLS.map((tool) => (
              <Link
                key={tool.slug}
                to={`/tools/${tool.slug}`}
                className="group p-6 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:shadow-[0_14px_32px_-8px_rgba(79,70,229,0.22)] dark:hover:shadow-[0_14px_32px_-8px_rgba(99,102,241,0.3)] hover:-translate-y-1 transition-all duration-200 ease-out flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getCategoryIconColorClass(
                        tool.category
                      )}`}
                    >
                      <CategoryIcon icon={tool.icon} className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {tool.mode === 'coming-soon' ? 'Coming Soon' : 'Ready in browser'}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-extrabold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                    {tool.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{tool.categoryName}</span>
                  <span className="font-semibold text-[#4F46E5] dark:text-indigo-400 inline-flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why NexcTool? (3 points) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-22">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Why NexcTool?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Built from the ground up so your documents, photos, and code stay strictly on your own device.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-7 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">100% Private</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your file never leaves your device. Processing happens inside your browser’s local memory with zero servers, zero uploads, and zero tracking.
            </p>
          </div>

          <div className="p-7 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">100% Free</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              No accounts, no watermarks, no daily file caps, and no paywalls. Every supported tool is free for personal and commercial work.
            </p>
          </div>

          <div className="p-7 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center">
              <WifiOff className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Works Offline</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Because there is no backend queue or network upload, tools respond instantly and keep working right on your machine even offline.
            </p>
          </div>
        </div>

        <div className="mt-12 p-7 sm:p-10 bg-gradient-to-br from-[#0F172A] via-[#131B36] to-[#1E1B4B] text-white rounded-[24px] shadow-xl shadow-indigo-950/20 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <Zap className="w-4 h-4" aria-hidden="true" />
              <span>Instant Browser Execution</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Ready to process a file without uploading it?
            </h3>
            <p className="text-sm text-slate-300">
              Jump straight into JPG to PNG, Image Compressor, Merge PDF, or explore all {TOOLS.length} tools.
            </p>
          </div>
          <Link
            to="/all-tools"
            className="px-7 py-3.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap shrink-0"
          >
            Explore All {TOOLS.length} Tools
          </Link>
        </div>
      </section>
    </>
  );
}
