import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { CATEGORIES, TOOLS, searchTools } from '../data/tools';
import { useTheme } from '../context/ThemeContext';
import { CategoryIcon } from './CategoryIcon';
import { openCommandSearch } from './CommandSearchModal';

export function NexcToolLogoMark({ darkSurface = false }: { darkSurface?: boolean }) {
  return (
    <img
      src="/assets/aistudio/IMG_0514_81b1a88b.png"
      alt="NexcTool logo"
      width={32}
      height={32}
      referrerPolicy="no-referrer"
      className={`w-8 h-8 object-contain shrink-0 rounded-lg ${
        darkSurface ? 'bg-white/95 p-0.5' : 'dark:bg-white/95 dark:p-0.5'
      }`}
    />
  );
}

export function SiteHeader() {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const searchRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setCategoriesOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCategoriesOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setCategoriesOpen(false);
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          mobileToggleRef.current?.focus();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchTools(query, 8);
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      navigate(`/tools/${results[0].slug}`);
      setQuery('');
      setSearchOpen(false);
      setMobileMenuOpen(false);
    } else if (query.trim()) {
      navigate(`/all-tools?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  const isRouteActive = (path: string) => location.pathname === path;

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white/75 dark:bg-[#090D16]/75 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 transition-all duration-200 ${
          isScrolled ? 'shadow-sm shadow-slate-900/5 dark:shadow-black/30' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#4F46E5] rounded-md"
          >
            <NexcToolLogoMark />
            <span>
              Nexc
              <span className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                Tool
              </span>
            </span>
          </Link>

          {/* Zone 2: Header Search Bar */}
          <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
            <form onSubmit={handleSearchSubmit} role="search" aria-label="Search tools">
              <label htmlFor="header-tool-search" className="sr-only">
                Search 200+ tools
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="header-tool-search"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search 200+ tools..."
                  className="w-full h-10 pl-10 pr-16 text-sm bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-700/80 rounded-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={openCommandSearch}
                  aria-label="Open quick command search (Ctrl+K or Cmd+K)"
                  title="Quick search (Ctrl+K / Cmd+K)"
                  data-testid="header-cmdk-trigger"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 hover:text-[#4F46E5] dark:hover:text-indigo-300 hover:border-[#4F46E5] transition-colors cursor-pointer"
                >
                  ⌘K
                </button>
              </div>
            </form>

            {searchOpen && query.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden z-50">
                {results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    No matching tools found for "{query}".
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                    {results.map((tool) => (
                      <li key={tool.slug}>
                        <Link
                          to={`/tools/${tool.slug}`}
                          onClick={() => setQuery('')}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {tool.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {tool.categoryName}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 whitespace-nowrap shrink-0">
                            {tool.mode === 'coming-soon' ? 'Preview' : 'Open'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Zone 3: Categories Menu, Navigation & Theme Toggle (Desktop >= 768px) */}
          <div className="hidden md:flex items-center gap-5 shrink-0">
            <nav aria-label="Primary navigation" className="flex items-center gap-6">
              <div ref={catRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCategoriesOpen((prev) => !prev)}
                  aria-expanded={categoriesOpen}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0 py-2 cursor-pointer"
                >
                  <span>Categories</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {categoriesOpen && (
                  <div className="absolute right-0 mt-2 w-[440px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/60 p-3 z-50">
                    <div className="grid grid-cols-2 gap-1.5">
                      {CATEGORIES.map((cat) => {
                        const active = isRouteActive(`/category/${cat.slug}`);
                        return (
                          <Link
                            key={cat.slug}
                            to={`/category/${cat.slug}`}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors group ${
                              active
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <span
                              className={`transition-colors ${
                                active
                                  ? 'text-[#4F46E5] dark:text-indigo-300'
                                  : 'text-slate-500 dark:text-slate-400 group-hover:text-[#4F46E5] dark:group-hover:text-indigo-300'
                              }`}
                            >
                              <CategoryIcon icon={cat.icon} className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`text-sm font-semibold truncate ${
                                  active
                                    ? 'text-[#4F46E5] dark:text-indigo-300'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {cat.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {cat.expectedCount} tools
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Link
                        to="/all-tools"
                        className="block text-center py-1.5 text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline"
                      >
                        Browse All {TOOLS.length} Tools
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link
                to="/all-tools"
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isRouteActive('/all-tools')
                    ? 'text-[#4F46E5] dark:text-indigo-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:text-[#4F46E5] dark:hover:text-indigo-400'
                }`}
              >
                All Tools
              </Link>
            </nav>

            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-toggle"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:text-[#4F46E5] dark:hover:text-indigo-300 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Mobile Controls (< 768px): Theme Toggle + Hamburger Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-toggle-mobile"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-[#4F46E5] transition-all cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              ref={mobileToggleRef}
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Overlay Drawer + Backdrop (< 768px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-14 sm:top-16 bottom-0 z-40 md:hidden flex flex-col">
          {/* Backdrop */}
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-x-0 top-14 sm:top-16 bottom-0 bg-slate-900/45 dark:bg-black/65 backdrop-blur-[2px]"
          />

          {/* Scrollable Drawer Sheet */}
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            className="relative z-10 bg-white dark:bg-[#0F1624] border-b border-slate-200 dark:border-slate-800 shadow-2xl max-h-full overflow-y-auto px-4 py-4 space-y-5"
          >
            {/* Mobile Search */}
            <form onSubmit={handleSearchSubmit} role="search" aria-label="Search tools on mobile">
              <label htmlFor="mobile-tool-search" className="sr-only">
                Search 200+ tools
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="mobile-tool-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search 200+ tools..."
                  className="w-full h-11 pl-10 pr-4 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#4F46E5] focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </form>

            {/* Mobile Search Results or Empty State */}
            {query.trim().length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {results.length === 0 ? (
                  <div className="px-3.5 py-3 text-sm text-slate-500 dark:text-slate-400">
                    No matching tools found for "{query}".
                  </div>
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                      {results.slice(0, 6).map((tool) => (
                        <li key={tool.slug}>
                          <Link
                            to={`/tools/${tool.slug}`}
                            onClick={() => {
                              setQuery('');
                              setMobileMenuOpen(false);
                            }}
                            className="flex items-center justify-between gap-3 px-3.5 min-h-[44px] py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {tool.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {tool.categoryName}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 shrink-0">
                              {tool.mode === 'coming-soon' ? 'Preview' : 'Open'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={`/all-tools?q=${encodeURIComponent(query.trim())}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-[#4F46E5] dark:text-indigo-400"
                    >
                      <span>See all matching results</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Categories Grid with Counts & Active Highlight */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Categories
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const active = isRouteActive(`/category/${cat.slug}`);
                  return (
                    <Link
                      key={cat.slug}
                      to={`/category/${cat.slug}`}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 min-h-[48px] py-2 rounded-2xl border transition-colors ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-[#4F46E5] dark:border-indigo-400 text-[#4F46E5] dark:text-indigo-300'
                          : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white'
                            : 'bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300'
                        }`}
                      >
                        <CategoryIcon icon={cat.icon} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{cat.shortName}</div>
                        <div
                          className={`text-xs tabular-nums ${
                            active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {cat.expectedCount} tools
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Primary & Legal/Info Navigation Links */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <Link
                to="/all-tools"
                aria-current={isRouteActive('/all-tools') ? 'page' : undefined}
                className="flex items-center justify-between px-5 min-h-[44px] rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-semibold shadow-md shadow-indigo-600/25"
              >
                <span>Browse All {TOOLS.length} Tools</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {[
                  { to: '/about', label: 'About' },
                  { to: '/contact', label: 'Contact' },
                  { to: '/privacy', label: 'Privacy Policy' },
                  { to: '/terms', label: 'Terms of Service' },
                ].map((item) => {
                  const active = isRouteActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center px-3 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
