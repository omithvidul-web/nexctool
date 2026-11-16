import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
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

// Split @ffmpeg/core WASM (~30.7 MiB) into two <16 MiB chunks so static hosts
// with a 25 MiB per-asset cap (e.g. Cloudflare Workers Assets) deploy cleanly.
const ffmpegWasmSrc = resolve(process.cwd(), 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm');
const ffmpegPublicDir = resolve(publicDir, 'wasm/ffmpeg');
const part1Path = resolve(ffmpegPublicDir, 'ffmpeg-core-part1.bin');
const part2Path = resolve(ffmpegPublicDir, 'ffmpeg-core-part2.bin');

if (existsSync(ffmpegWasmSrc)) {
  mkdirSync(ffmpegPublicDir, { recursive: true });
  const srcSize = statSync(ffmpegWasmSrc).size;
  const alreadySynced =
    existsSync(part1Path) &&
    existsSync(part2Path) &&
    statSync(part1Path).size + statSync(part2Path).size === srcSize;

  if (!alreadySynced) {
    const raw = readFileSync(ffmpegWasmSrc);
    const midpoint = Math.ceil(raw.byteLength / 2);
    writeFileSync(part1Path, raw.subarray(0, midpoint));
    writeFileSync(part2Path, raw.subarray(midpoint));
  }
}

console.log(`Generated sitemap.xml (${urls.length} URLs), robots.txt in public/`);
