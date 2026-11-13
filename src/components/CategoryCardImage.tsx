import { useState } from 'react';
import type { CategorySlug } from '../data/tools';
import { CategoryIcon } from './CategoryIcon';

import catImageTools from '../assets/images/cat_image_tools_1794575198736.jpg';
import catPdfTools from '../assets/images/cat_pdf_tools_1794575198618.jpg';
import catDocumentTools from '../assets/images/cat_document_tools_1794575200869.jpg';
import catSpreadsheetTools from '../assets/images/cat_spreadsheet_tools_1794575201340.jpg';
import catPresentationTools from '../assets/images/cat_presentation_tools_1794575201307.jpg';
import catVideoTools from '../assets/images/cat_video_tools_1794575204317.jpg';
import catAudioTools from '../assets/images/cat_audio_tools_1794575201444.jpg';
import catArchiveTools from '../assets/images/cat_archive_tools_1794575202885.jpg';
import catDeveloperTools from '../assets/images/cat_developer_tools_1794575201659.jpg';
import catFileUtilities from '../assets/images/cat_file_utilities_1794575204436.jpg';

const CATEGORY_IMAGES: Record<CategorySlug, string> = {
  'image-tools': catImageTools,
  'pdf-tools': catPdfTools,
  'document-tools': catDocumentTools,
  'spreadsheet-tools': catSpreadsheetTools,
  'presentation-tools': catPresentationTools,
  'video-tools': catVideoTools,
  'audio-tools': catAudioTools,
  'archive-tools': catArchiveTools,
  'text-developer-tools': catDeveloperTools,
  'file-utilities': catFileUtilities,
};

interface CategoryCardImageProps {
  slug: CategorySlug;
  name: string;
  icon: string;
  className?: string;
}

export function CategoryCardImage({
  slug,
  name,
  icon,
  className = '',
}: CategoryCardImageProps) {
  const [hasError, setHasError] = useState(false);
  const src = CATEGORY_IMAGES[slug];

  return (
    <div
      className={`relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-indigo-50 via-slate-100 to-violet-50 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950/60 ${className}`}
    >
      {!hasError && src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[#4F46E5] dark:text-indigo-300">
          <CategoryIcon icon={icon} className="w-8 h-8" />
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/15 to-transparent dark:from-black/35"
      />
    </div>
  );
}
