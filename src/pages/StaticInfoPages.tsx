import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, FileText, Lock, Mail, RotateCcw, ShieldCheck } from 'lucide-react';
import { SeoHead } from '../components/SeoHead';
import {
  CONTACT_EMAIL,
  buildContactMailtoUrl,
  buildGmailComposeUrl,
} from '../utils/contactMailto';

export function AboutPage() {
  return (
    <>
      <SeoHead
        title="About NexcTool - 100% Private Browser File Tools"
        description="Learn how NexcTool runs 200 file tools directly inside your browser with zero servers and zero file uploads."
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            About NexcTool
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            NexcTool was built around one simple rule:{' '}
            <strong className="text-slate-900 dark:text-white">your file never leaves your device.</strong>
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[20px] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-[#4F46E5] dark:text-indigo-400 font-bold">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            <span>Zero Servers, Zero Uploads</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Traditional file converters upload your sensitive invoices, contracts, and photos to remote cloud servers. NexcTool eliminates that risk by running file processing directly inside your web browser using modern Web APIs such as HTML5 Canvas, Web Crypto, CompressionStream, and pure JavaScript PDF engines.
          </p>
        </div>

        <div className="space-y-3 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Why static browser processing matters
          </h2>
          <p>
            Because there is no backend server receiving your data, there are no upload wait times, no login walls, and no risk of third-party file retention. Once a tool page loads, everything executes locally on your CPU and memory.
          </p>
        </div>

        <Link
          to="/all-tools"
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:scale-[1.02] transition-all"
        >
          Browse All 200+ Tools
        </Link>
      </div>
    </>
  );
}

export function PrivacyPage() {
  return (
    <>
      <SeoHead
        title="Privacy Policy - NexcTool"
        description="NexcTool Privacy Policy: zero file uploads, zero tracking cookies, and 100% browser-side file processing."
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <div className="flex items-center gap-3 text-[#4F46E5] dark:text-indigo-400">
          <Lock className="w-6 h-6" aria-hidden="true" />
          <span className="text-sm font-semibold">Privacy First Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Privacy Policy
        </h1>
        <div className="space-y-5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              1. No File Uploads or Server Storage
            </h2>
            <p>
              NexcTool is a 100% static client-side web application. We do not operate file-processing servers or databases. Any file you select or drop into a tool is read solely inside your own browser tab and never transmitted over the network.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              2. No Accounts or Personal Data Collection
            </h2>
            <p>
              NexcTool requires no registration, login, or email address to use any of the 200+ file tools.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              3. Local Memory Cleanup
            </h2>
            <p>
              Processed outputs exist only as temporary in-memory browser objects (`Blob` URLs) and are automatically discarded when you reset the tool or close the browser tab.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mailtoUrl = buildContactMailtoUrl({ name, email, message });
  const gmailUrl = buildGmailComposeUrl({ name, email, message });

  const triggerMailto = (href: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in your name, email address, and message.');
      return;
    }
    setError('');
    setSubmitted(true);
    triggerMailto(mailtoUrl);
  };

  const handleReset = () => {
    setSubmitted(false);
    setError('');
  };

  return (
    <>
      <SeoHead
        title="Contact - NexcTool"
        description={`Contact NexcTool at ${CONTACT_EMAIL} to request a browser-native file format or share feedback.`}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Contact NexcTool
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Have a suggestion for a new browser-based tool or feedback on an existing converter? Reach out directly at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[#4F46E5] dark:text-indigo-400 font-semibold hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{' '}
            or send a message below.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[20px] shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <Mail className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400 shrink-0" aria-hidden="true" />
            <span className="font-medium">Direct Email:</span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-mono font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {submitted ? (
          <div className="p-6 rounded-[20px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#16A34A] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Opening your email app</h2>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Thank you, {name.trim()}. Your message to{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#4F46E5] dark:text-indigo-400 font-semibold underline">
                    {CONTACT_EMAIL}
                  </a>{' '}
                  has been prepared. If your email client didn&rsquo;t open automatically, use one of the options below.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={mailtoUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-full transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Open Email App</span>
                </a>
                <a
                  href={gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-full transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
                  <span>Open in Gmail</span>
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Edit Message</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[20px] shadow-xs space-y-4"
          >
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}
            <div>
              <label htmlFor="contact-name" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Name
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full h-11 px-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Message
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Which file tool or feature would you like to see next?"
                className="w-full p-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#4F46E5] dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white text-sm font-semibold rounded-full shadow-md shadow-indigo-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>Send Message</span>
            </button>
          </form>
        )}
      </div>
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <SeoHead
        title="Terms of Service - NexcTool"
        description="Read the NexcTool Terms of Service: free 100% browser-based file processing, user ownership, and service terms."
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <div className="flex items-center gap-3 text-[#4F46E5] dark:text-indigo-400">
          <FileText className="w-6 h-6" aria-hidden="true" />
          <span className="text-sm font-semibold">Legal &amp; Usage Guidelines</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Last updated: November 2026
        </p>

        <div className="space-y-5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using NexcTool, you agree to these Terms of Service. All file conversion, editing, and developer preview utilities are provided completely free of charge for personal and commercial use without requiring an account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              2. 100% Local Browser Processing
            </h2>
            <p>
              NexcTool operates entirely inside your own web browser. Your files, text, and code inputs never leave your device and are never uploaded to or stored on NexcTool servers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              3. User Responsibility &amp; File Ownership
            </h2>
            <p>
              You retain full copyright, ownership, and responsibility for all files, scripts, and content processed with NexcTool. You agree not to use the tools for unlawful purposes or to process content you do not have permission to handle.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              4. Disclaimer of Warranties
            </h2>
            <p>
              NexcTool is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis. While we strive for accurate local file conversions and code previews, we recommend keeping backups of important original files before modifying or converting them.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              5. Limitation of Liability
            </h2>
            <p>
              Because all processing executes locally within your browser environment, NexcTool shall not be held liable for any direct or indirect data loss, browser memory limits, or output compatibility issues resulting from use of the site.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              6. Changes &amp; Contact
            </h2>
            <p>
              We may update these Terms of Service as new browser capabilities are added. If you have any questions, please reach out via our{' '}
              <Link to="/contact" className="text-[#4F46E5] dark:text-indigo-400 font-semibold hover:underline">
                Contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
