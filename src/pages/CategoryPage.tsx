import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, Search } from 'lucide-react';
import { CATEGORIES, getCategoryBySlug, getToolsByCategory } from '../data/tools';
import { CategoryIcon } from '../components/CategoryIcon';
import { CategoryCardImage } from '../components/CategoryCardImage';
import { SeoHead } from '../components/SeoHead';

export function CategoryPage() {
  const { categorySlug = '' } = useParams();
  const [filter, setFilter] = useState('');

  const category = getCategoryBySlug(categorySlug);
  const tools = useMemo(
    () => (category ? getToolsByCategory(category.slug) : []),
    [category]
  );

  const filteredTools = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [tools, filter]);

  if (!category) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <SeoHead
          title="Category Not Found - NexcTool"
          description="The requested tool category could not be found on NexcTool."
        />
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Category not found
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Browse our 10 file tool categories or search all 200+ tools.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:scale-[1.02] transition-all"
        >
          Back to Homepage
        </Link>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title={`${category.name} Free Online - NexcTool`}
        description={`${category.description} Explore ${tools.length} free browser-based ${category.name.toLowerCase()} on NexcTool.`}
      />

      <div className="bg-white/70 dark:bg-[#0D1322] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
            <Link to="/" className="hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600" aria-hidden="true" />
            <span className="text-slate-900 dark:text-white font-semibold">{category.name}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-500/30 text-[#4F46E5] dark:text-indigo-300 flex items-center justify-center shrink-0">
                <CategoryIcon icon={category.icon} className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {category.name}
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
                  {category.description} · <span className="tabular-nums font-semibold">{tools.length} tools</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-full md:w-72">
                <label htmlFor="category-filter" className="sr-only">
                  Filter {category.name}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="category-filter"
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={`Filter ${category.name.toLowerCase()}...`}
                    className="w-full h-11 pl-10 pr-4 text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs focus:outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="hidden lg:block w-44 shrink-0 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <CategoryCardImage
                  slug={category.slug}
                  name={category.name}
                  icon={category.icon}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {filteredTools.length === 0 ? (
          <div className="p-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[20px] text-center text-slate-600 dark:text-slate-400">
            No tools matched "{filter}" in {category.name}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => (
              <Link
                key={tool.slug}
                to={`/tools/${tool.slug}`}
                className="group p-6 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[20px] shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:shadow-[0_14px_32px_-8px_rgba(79,70,229,0.22)] dark:hover:shadow-[0_14px_32px_-8px_rgba(99,102,241,0.3)] transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                      {tool.name}
                    </h2>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {tool.mode === 'coming-soon' ? 'Coming Soon' : 'Browser'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-[#4F46E5] dark:text-indigo-400">
                  <span>Open {tool.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Other Categories */}
        <div className="mt-14 pt-10 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Other Tool Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.slug !== category.slug).map((c) => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-[#4F46E5] dark:hover:border-indigo-400 hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-all"
              >
                <CategoryIcon icon={c.icon} className="w-4 h-4" />
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
