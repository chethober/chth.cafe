import { LOCALE_CODES, type Locale } from '../../src/chth-kit/locales.js';

/** The public origin search engines should index, whichever hostname served the request. */
export const SITE = 'https://chth.cafe';
const SITE_NAME = 'CHTH Café Cloud';

const OG_LOCALE: Record<Locale, string> = { en: 'en_US', fa: 'fa_IR', ar: 'ar_AR', ru: 'ru_RU', es: 'es_ES' };

/** English is the root page; every other language is the same page with ?lang=, which is how the language menu links. */
const urlFor = (locale: Locale) => locale === 'en' ? `${SITE}/` : `${SITE}/?lang=${locale}`;
const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** Canonical, language alternates, Open Graph, Twitter and structured data for the landing page's <head>. */
export function landingSeo(locale: Locale, title: string, description: string) {
  const url = urlFor(locale);
  const tags = [
    `<link rel="canonical" href="${url}">`,
    ...LOCALE_CODES.map(code => `<link rel="alternate" hreflang="${code}" href="${urlFor(code)}">`),
    `<link rel="alternate" hreflang="x-default" href="${urlFor('en')}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${OG_LOCALE[locale]}">`,
    ...LOCALE_CODES.filter(code => code !== locale).map(code => `<meta property="og:locale:alternate" content="${OG_LOCALE[code]}">`),
    `<meta property="og:image" content="${SITE}/logo.png">`,
    '<meta property="og:image:width" content="512">',
    '<meta property="og:image:height" content="512">',
    `<meta property="og:image:alt" content="${SITE_NAME}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(description)}">`,
    `<meta name="twitter:image" content="${SITE}/logo.png">`,
    `<script type="application/ld+json">${jsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: SITE_NAME, inLanguage: LOCALE_CODES },
        {
          '@type': 'SoftwareApplication',
          '@id': `${SITE}/#app`,
          name: 'CHTH Café',
          url: `${SITE}/`,
          description,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          isAccessibleForFree: true,
          license: 'https://opensource.org/license/mit',
          codeRepository: 'https://github.com/chethober/chth.cafe',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@type': 'Organization', name: 'CHTH', url: 'https://chth.wtf' }
        }
      ]
    })}</script>`
  ];
  return tags.join('\n');
}

export const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /cafes/
Disallow: /connect/
Disallow: /disconnect
Disallow: /signout
Disallow: /internal/
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`;

export function sitemapXml() {
  const alternates = [...LOCALE_CODES.map(code => `    <xhtml:link rel="alternate" hreflang="${code}" href="${attr(urlFor(code))}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('en')}"/>`].join('\n');
  const entries = LOCALE_CODES.map(code => `  <url>\n    <loc>${attr(urlFor(code))}</loc>\n${alternates}\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
}
