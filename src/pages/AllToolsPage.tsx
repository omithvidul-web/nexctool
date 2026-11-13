import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { CATEGORIES, TOOLS, type CategorySlug, searchTools } from '../data/tools';
import { CategoryIcon, getCategoryIconColorClass } from '../components/CategoryIcon';
import { SeoHead } from '../components/SeoHead';

export function AllToolsPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');

  const filtered = useMemo(() => {
    const base = query.trim() ? searchTools(query) : TOOLS;
    if (selectedCategory === 'all') return base;
    return base.filter((t) => t.category === selectedCategory);
  }, [query, selectedCategory]);

  return (
    <>
      <SeoHead
        title="All 200 Free Online File Tools - NexcTool"
        description="Browse all 200 free, 100% private online file tools across images, PDFs, documents, spreadsheets, video, audio, archives, and developer utilities."
      />

      <div className="bg-white/70 dark:bg-[#0D1322] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            All {TOOLS.length} Online File Tools
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
            Every supported tool runs directly inside your browser. Your file never leaves your device.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <label htmlFor="directory-search" className="sr-only">
                Search 200+ tools
              </label>
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="directory-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 200+ tools..."
                className="w-full h-11 pl-10 pr-4 text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs focus:outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center tabular-nums">
              Showing {filtered.length} of {TOOLS.length} tools
            </div>
          </div>

          {/* Interactive Category Filter Buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-sm shadow-indigo-600/25'
                  : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#4F46E5] dark:hover:border-indigo-400'
              }`}
            >
              All ({TOOLS.length})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat.slug
                    ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-sm shadow-indigo-600/25'
                    : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#4F46E5] dark:hover:border-indigo-400'
                }`}
              >
                {cat.shortName} ({cat.expectedCount})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {filtered.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[20px] text-slate-600 dark:text-slate-400">
            No tools found matching "{query}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((tool) => (
              <Link
                key={tool.slug}
                to={`/tools/${tool.slug}`}
                className="group p-5 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:shadow-[0_14px_32px_-8px_rgba(79,70,229,0.22)] dark:hover:shadow-[0_14px_32px_-8px_rgba(99,102,241,0.3)] transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${getCategoryIconColorClass(
                          tool.category
                        )}`}
                      >
                        <CategoryIcon icon={tool.icon} className="w-3.5 h-3.5" />
                      </span>
                      <span>{tool.categoryName}</span>
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {tool.mode === 'coming-soon' ? 'Soon' : 'Ready'}
                    </span>
                  </div>
                  <h2 className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                    {tool.name}
                  </h2>
                </div>
                <div className="mt-3.5 flex items-center justify-between text-xs font-semibold text-[#4F46E5] dark:text-indigo-400">
                  <span>Use tool</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
