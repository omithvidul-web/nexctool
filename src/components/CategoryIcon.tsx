import {
  Archive,
  BookOpen,
  Code2,
  FileText,
  Image as ImageIcon,
  Music,
  Presentation,
  Table2,
  Video,
  Wrench,
} from 'lucide-react';
import type { CategorySlug } from '../data/tools';

interface CategoryIconProps {
  icon: string;
  className?: string;
}

export function CategoryIcon({ icon, className = 'w-5 h-5' }: CategoryIconProps) {
  switch (icon) {
    case 'image':
      return <ImageIcon className={className} aria-hidden="true" />;
    case 'file-text':
      return <FileText className={className} aria-hidden="true" />;
    case 'book-open':
      return <BookOpen className={className} aria-hidden="true" />;
    case 'table':
      return <Table2 className={className} aria-hidden="true" />;
    case 'presentation':
      return <Presentation className={className} aria-hidden="true" />;
    case 'video':
      return <Video className={className} aria-hidden="true" />;
    case 'music':
      return <Music className={className} aria-hidden="true" />;
    case 'archive':
      return <Archive className={className} aria-hidden="true" />;
    case 'code':
      return <Code2 className={className} aria-hidden="true" />;
    case 'wrench':
    default:
      return <Wrench className={className} aria-hidden="true" />;
  }
}

const CATEGORY_ICON_COLORS: Record<CategorySlug, string> = {
  'image-tools': 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300',
  'pdf-tools': 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
  'document-tools': 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
  'spreadsheet-tools': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
  'presentation-tools': 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300',
  'video-tools': 'bg-green-50 text-green-600 dark:bg-green-950/60 dark:text-green-300',
  'audio-tools': 'bg-pink-50 text-pink-600 dark:bg-pink-950/60 dark:text-pink-300',
  'archive-tools': 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  'text-developer-tools': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
  'file-utilities': 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300',
};

export function getCategoryIconColorClass(category: CategorySlug): string {
  return CATEGORY_ICON_COLORS[category] ?? 'bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-300';
}
