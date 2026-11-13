import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Home, Search } from 'lucide-react';
import { CATEGORIES, TOOLS, searchTools } from '../data/tools';
import { CategoryIcon, getCategoryIconColorClass } from '../components/CategoryIcon';
import { SeoHead } from '../components/SeoHead';

export function NotFoundPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return searchTools(query, 6);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (matches.length > 0) {
      navigate(`/tools/${matches[0].slug}`);
    } else if (query.trim()) {
      navigate(`/all-tools?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <>
      <SeoHead
        title="Page Not Found (404) - NexcTool"
        description="The page you requested could not be found on NexcTool. Search 200+ free private browser tools or explore categories."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-500/30 text-xs font-bold text-[#4F46E5] dark:text-indigo-300 mb-6">
          <span>Error 404</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Page Not Found
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          That link doesn’t match any NexcTool page. Search all {TOOLS.length} browser tools below or jump straight to a category.
        </p>

        {/* Instant Tool Search */}
        <div className="mt-8 max-w-xl mx-auto text-left">
          <form onSubmit={handleSubmit} role="search" aria-label="Search tools from 404 page">
            <label htmlFor="notfound-search" className="sr-only">
              Search 200+ tools
            </label>
            <div className="flex items-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-full p-1.5 shadow-lg shadow-slate-900/5 dark:shadow-black/40 focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-indigo-500/15 transition-all">
              <Search className="w-5 h-5 text-slate-400 ml-3.5 shrink-0" aria-hidden="true" />
              <input
                id="notfound-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 200+ tools (e.g. jpg to png, merge pdf, zip)..."
                className="w-full h-10 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-xs sm:text-sm font-semibold rounded-full shadow-sm hover:scale-[1.02] transition-all shrink-0 cursor-pointer"
              >
                Find Tool
              </button>
            </div>
          </form>

          {query.trim().length > 0 && (
            <div className="mt-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden">
              {matches.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  No matching tools found for "{query}".
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matches.map((tool) => (
                    <li key={tool.slug}>
                      <Link
                        to={`/tools/${tool.slug}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
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
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{tool.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{tool.categoryName}</div>
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

        {/* Primary Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:scale-[1.02] transition-all"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Back to Homepage</span>
          </Link>
          <Link
            to="/all-tools"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-[#4F46E5] text-sm font-semibold rounded-full transition-all"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>Browse All {TOOLS.length} Tools</span>
          </Link>
        </div>

        {/* Quick Category Grid */}
        <div className="mt-12 text-left">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 text-center">
            Popular Categories
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CATEGORIES.slice(0, 6).map((cat) => (
              <Link
                key={cat.slug}
                to={`/category/${cat.slug}`}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 hover:border-[#4F46E5] dark:hover:border-indigo-400 transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <CategoryIcon icon={cat.icon} className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{cat.shortName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{cat.expectedCount} tools</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
