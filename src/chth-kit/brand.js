// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The CHTH brand: tokens, the logo mark and the brand stylesheet, from kit/brand.

export const BRAND = {
  "name": "CHTH",
  "tagline": {
    "en": "Small, free and open-source tools",
    "fa": "ابزارهای کوچک، رایگان و متن‌باز",
    "ar": "أدوات صغيرة ومجانية ومفتوحة المصدر",
    "ru": "Небольшие бесплатные инструменты с открытым кодом",
    "es": "Herramientas pequeñas, gratuitas y de código abierto"
  },
  "color": {
    "ink": "#09090b",
    "inkSoft": "#18181b",
    "paper": "#fafaf9",
    "paperSoft": "#f4f4f5",
    "muted": "#71717a",
    "line": "rgba(127, 127, 127, 0.22)",
    "accent": "#ff6a2b",
    "accentHover": "#ff7d45",
    "onAccent": "#1a0a02",
    "success": "#10b981",
    "warning": "#f59e0b",
    "danger": "#f43f5e",
    "telegram": "#2ca5e0"
  },
  "products": {
    "cafe": {
      "accent": "#f59e0b",
      "accentHover": "#d97706",
      "onAccent": "#451a03"
    },
    "gym": {
      "accent": "#ff6a2b",
      "accentHover": "#ff7d45",
      "onAccent": "#1a0a02"
    },
    "shop": {
      "accent": "#f97316",
      "accentHover": "#ea580c",
      "onAccent": "#1a0a02"
    },
    "hub": {
      "accent": "#ff6a2b",
      "accentHover": "#ff7d45",
      "onAccent": "#1a0a02"
    }
  },
  "font": {
    "sans": "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    "display": "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
    "mono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    "rtl": "'Vazirmatn', system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif"
  },
  "fontCss": {
    "latin": "https://fonts.googleapis.com/css2?family=Outfit:wght@400..800&family=Plus+Jakarta+Sans:wght@300..800&display=swap",
    "rtl": "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300..900&display=swap"
  },
  "radius": {
    "sm": "8px",
    "md": "10px",
    "lg": "14px",
    "xl": "20px",
    "full": "9999px"
  }
};

/** The logo mark as inline SVG (fill: currentColor). */
export const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" fill=\"currentColor\" role=\"img\" aria-label=\"CHTH\">\n  <title>CHTH</title>\n  <path d=\"M0 168C160 172 255 300 268 510C240 380 160 295 0 290Z\"/>\n  <path d=\"M288 140C400 135 480 80 505 5C470 140 340 180 288 365Z\"/>\n</svg>";

/** brand.css as a string, for pages rendered without a bundler. */
export const BRAND_CSS = ":root {\n  --chth-ink: #09090b;\n  --chth-ink-soft: #18181b;\n  --chth-paper: #fafaf9;\n  --chth-paper-soft: #f4f4f5;\n  --chth-muted: #71717a;\n  --chth-line: rgba(127, 127, 127, 0.22);\n  --chth-accent: #ff6a2b;\n  --chth-accent-hover: #ff7d45;\n  --chth-on-accent: #1a0a02;\n  --chth-success: #10b981;\n  --chth-warning: #f59e0b;\n  --chth-danger: #f43f5e;\n  --chth-telegram: #2ca5e0;\n  --chth-font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;\n  --chth-font-display: 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif;\n  --chth-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;\n  --chth-font-rtl: 'Vazirmatn', system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif;\n  --chth-radius-sm: 8px;\n  --chth-radius-md: 10px;\n  --chth-radius-lg: 14px;\n  --chth-radius-xl: 20px;\n  --chth-radius-full: 9999px;\n  --chth-cafe-accent: #f59e0b;\n  --chth-cafe-accent-hover: #d97706;\n  --chth-cafe-on-accent: #451a03;\n  --chth-gym-accent: #ff6a2b;\n  --chth-gym-accent-hover: #ff7d45;\n  --chth-gym-on-accent: #1a0a02;\n  --chth-shop-accent: #f97316;\n  --chth-shop-accent-hover: #ea580c;\n  --chth-shop-on-accent: #1a0a02;\n  --chth-hub-accent: #ff6a2b;\n  --chth-hub-accent-hover: #ff7d45;\n  --chth-hub-on-accent: #1a0a02;\n  --chth-product-accent: var(--chth-accent);\n  --chth-product-accent-hover: var(--chth-accent-hover);\n  --chth-product-on-accent: var(--chth-on-accent);\n}\n\n[data-chth-product=\"cafe\"] {\n  --chth-product-accent: var(--chth-cafe-accent);\n  --chth-product-accent-hover: var(--chth-cafe-accent-hover);\n  --chth-product-on-accent: var(--chth-cafe-on-accent);\n}\n\n[data-chth-product=\"gym\"] {\n  --chth-product-accent: var(--chth-gym-accent);\n  --chth-product-accent-hover: var(--chth-gym-accent-hover);\n  --chth-product-on-accent: var(--chth-gym-on-accent);\n}\n\n[data-chth-product=\"shop\"] {\n  --chth-product-accent: var(--chth-shop-accent);\n  --chth-product-accent-hover: var(--chth-shop-accent-hover);\n  --chth-product-on-accent: var(--chth-shop-on-accent);\n}\n\n[data-chth-product=\"hub\"] {\n  --chth-product-accent: var(--chth-hub-accent);\n  --chth-product-accent-hover: var(--chth-hub-accent-hover);\n  --chth-product-on-accent: var(--chth-hub-on-accent);\n}\n\n/* Persian and Arabic pages use the RTL font wherever the brand sans font is used. */\n:root:lang(fa), :root:lang(ar), [dir=\"rtl\"] { --chth-font-sans: var(--chth-font-rtl); --chth-font-display: var(--chth-font-rtl); }\n\n/* Shared CHTH components. Colors come from the surrounding page (currentColor) plus the brand\n   variables, so the same footer fits a dark café menu, the gym app and the light shop. */\n\n.chth-footer {\n  border-top: 1px solid var(--chth-line);\n  color: inherit;\n  font-family: var(--chth-font-sans);\n  font-size: 0.875rem;\n  line-height: 1.5;\n  padding: 2.5rem 1.25rem calc(2rem + env(safe-area-inset-bottom, 0px));\n}\n.chth-footer__inner {\n  display: grid;\n  gap: 2rem;\n  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));\n  margin-inline: auto;\n  max-width: 72rem;\n}\n.chth-footer__brand { align-items: center; display: flex; gap: 0.75rem; }\n.chth-footer__brand small { opacity: 0.65; }\n.chth-footer__mark { color: var(--chth-product-accent); display: inline-flex; height: 2rem; width: 2rem; }\n.chth-footer__mark svg { height: 100%; width: 100%; }\n.chth-footer h2 {\n  font-size: 0.75rem;\n  font-weight: 700;\n  letter-spacing: 0.06em;\n  margin: 0 0 0.75rem;\n  opacity: 0.6;\n  text-transform: uppercase;\n}\n.chth-footer ul { display: grid; gap: 0.4rem; list-style: none; margin: 0; padding: 0; }\n.chth-footer a { color: inherit; opacity: 0.85; text-decoration: none; }\n.chth-footer a:hover, .chth-footer a:focus-visible { color: var(--chth-product-accent); opacity: 1; }\n.chth-footer p { margin: 0.75rem 0 0; }\n.chth-footer__langs { display: flex; flex-wrap: wrap; gap: 0.4rem; }\n.chth-footer__langs a,\n.chth-lang-switch button {\n  border: 1px solid var(--chth-line);\n  border-radius: var(--chth-radius-full);\n  padding: 0.2rem 0.7rem;\n}\n.chth-footer__langs a[aria-current=\"true\"],\n.chth-lang-switch button[aria-pressed=\"true\"] {\n  background: var(--chth-product-accent);\n  border-color: var(--chth-product-accent);\n  color: var(--chth-product-on-accent);\n  opacity: 1;\n}\n\n.chth-lang-switch { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; }\n.chth-lang-switch button {\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font: inherit;\n  font-size: 0.8125rem;\n}\n";

/** A product's accent colors (cafe, gym, shop, hub), or the brand accent. */
export function productTheme(id) {
  const p = BRAND.products[id];
  return p ?? { accent: BRAND.color.accent, accentHover: BRAND.color.accentHover, onAccent: BRAND.color.onAccent };
}
