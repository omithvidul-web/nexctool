import { useEffect } from 'react';

export interface FaqSchemaItem {
  question: string;
  answer: string;
}

interface SeoHeadProps {
  title: string;
  description: string;
  imagePath?: string;
  faqs?: FaqSchemaItem[];
}

function upsertMeta(selector: string, attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function SeoHead({
  title,
  description,
  imagePath = '/assets/og-banner.jpg',
  faqs,
}: SeoHeadProps) {
  const faqKey = faqs ? JSON.stringify(faqs) : '';

  useEffect(() => {
    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    const origin = window.location.origin;
    const imageUrl = imagePath.startsWith('http') ? imagePath : `${origin}${imagePath}`;
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);

    const canonicalHref = origin + window.location.pathname;
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalHref);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalHref;

    const existingFaqScript = document.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"][data-seo-schema="faq"]'
    );

    if (faqs && faqs.length > 0) {
      const schemaPayload = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      };
      const scriptEl = existingFaqScript ?? document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.setAttribute('data-seo-schema', 'faq');
      scriptEl.textContent = JSON.stringify(schemaPayload);
      if (!existingFaqScript) {
        document.head.appendChild(scriptEl);
      }
    } else if (existingFaqScript) {
      existingFaqScript.remove();
    }

    return () => {
      const staleFaq = document.querySelector<HTMLScriptElement>(
        'script[type="application/ld+json"][data-seo-schema="faq"]'
      );
      if (staleFaq) {
        staleFaq.remove();
      }
    };
  }, [title, description, imagePath, faqKey, faqs]);

  return null;
}
