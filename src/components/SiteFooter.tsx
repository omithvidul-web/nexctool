import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/tools';
import { NexcToolLogoMark } from './SiteHeader';

export function SiteFooter() {
  return (
    <footer className="relative bg-[#070A12] text-slate-300 mt-24 border-t border-slate-800/80 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-800/80">
          <div className="md:col-span-4 space-y-3.5">
            <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-extrabold text-white">
              <NexcToolLogoMark darkSurface />
              <span>
                Nexc
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  Tool
                </span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
              Your file never leaves your device. 200+ free file conversion and utility tools designed for browser-only privacy.
            </p>
          </div>

          <div className="md:col-span-5">
            <h2 className="text-sm font-bold text-white mb-4">Categories</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to={`/category/${cat.slug}`}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="text-sm font-bold text-white mb-4">Company &amp; Directory</h2>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/all-tools" className="text-slate-400 hover:text-white transition-colors">
                  All Tools (200)
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-400 hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} NexcTool. All file processing runs locally inside your browser.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/all-tools" className="hover:text-white transition-colors">
              All Tools
            </Link>
            <Link to="/about" className="hover:text-white transition-colors">
              About
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
