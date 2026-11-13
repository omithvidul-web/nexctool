import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATEGORIES, TOOLS } from '../src/data/tools';

const BASE_URL = process.env.SITE_URL || 'https://nexctool.com';
const publicDir = resolve(process.cwd(), 'public');
mkdirSync(publicDir, { recursive: true });

const today = new Date().toISOString().split('T')[0];

const urls: { loc: string; priority: string; changefreq: string }[] = [
  { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'weekly' },
  { loc: `${BASE_URL}/all-tools`, priority: '0.9', changefreq: 'weekly' },
  { loc: `${BASE_URL}/about`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${BASE_URL}/privacy`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${BASE_URL}/terms`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${BASE_URL}/contact`, priority: '0.5', changefreq: 'monthly' },
  ...CATEGORIES.map((cat) => ({
    loc: `${BASE_URL}/category/${cat.slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  })),
  ...TOOLS.map((tool) => ({
    loc: `${BASE_URL}/tools/${tool.slug}`,
    priority: tool.popular ? '0.8' : '0.7',
    changefreq: 'monthly',
  })),
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;

writeFileSync(resolve(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
writeFileSync(resolve(publicDir, 'robots.txt'), robotsTxt, 'utf8');

console.log(`Generated sitemap.xml (${urls.length} URLs), robots.txt in public/`);
