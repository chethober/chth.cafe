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
export const BRAND_CSS = ":root {\n  --chth-ink: #09090b;\n  --chth-ink-soft: #18181b;\n  --chth-paper: #fafaf9;\n  --chth-paper-soft: #f4f4f5;\n  --chth-muted: #71717a;\n  --chth-line: rgba(127, 127, 127, 0.22);\n  --chth-accent: #ff6a2b;\n  --chth-accent-hover: #ff7d45;\n  --chth-on-accent: #1a0a02;\n  --chth-success: #10b981;\n  --chth-warning: #f59e0b;\n  --chth-danger: #f43f5e;\n  --chth-telegram: #2ca5e0;\n  --chth-font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;\n  --chth-font-display: 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif;\n  --chth-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;\n  --chth-font-rtl: 'Vazirmatn', system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif;\n  --chth-radius-sm: 8px;\n  --chth-radius-md: 10px;\n  --chth-radius-lg: 14px;\n  --chth-radius-xl: 20px;\n  --chth-radius-full: 9999px;\n  --chth-cafe-accent: #f59e0b;\n  --chth-cafe-accent-hover: #d97706;\n  --chth-cafe-on-accent: #451a03;\n  --chth-gym-accent: #ff6a2b;\n  --chth-gym-accent-hover: #ff7d45;\n  --chth-gym-on-accent: #1a0a02;\n  --chth-shop-accent: #f97316;\n  --chth-shop-accent-hover: #ea580c;\n  --chth-shop-on-accent: #1a0a02;\n  --chth-hub-accent: #ff6a2b;\n  --chth-hub-accent-hover: #ff7d45;\n  --chth-hub-on-accent: #1a0a02;\n  --chth-product-accent: var(--chth-accent);\n  --chth-product-accent-hover: var(--chth-accent-hover);\n  --chth-product-on-accent: var(--chth-on-accent);\n}\n\n[data-chth-product=\"cafe\"] {\n  --chth-product-accent: var(--chth-cafe-accent);\n  --chth-product-accent-hover: var(--chth-cafe-accent-hover);\n  --chth-product-on-accent: var(--chth-cafe-on-accent);\n}\n\n[data-chth-product=\"gym\"] {\n  --chth-product-accent: var(--chth-gym-accent);\n  --chth-product-accent-hover: var(--chth-gym-accent-hover);\n  --chth-product-on-accent: var(--chth-gym-on-accent);\n}\n\n[data-chth-product=\"shop\"] {\n  --chth-product-accent: var(--chth-shop-accent);\n  --chth-product-accent-hover: var(--chth-shop-accent-hover);\n  --chth-product-on-accent: var(--chth-shop-on-accent);\n}\n\n[data-chth-product=\"hub\"] {\n  --chth-product-accent: var(--chth-hub-accent);\n  --chth-product-accent-hover: var(--chth-hub-accent-hover);\n  --chth-product-on-accent: var(--chth-hub-on-accent);\n}\n\n/* Persian and Arabic pages use the RTL font wherever the brand sans font is used. */\n:root:lang(fa), :root:lang(ar), [dir=\"rtl\"] { --chth-font-sans: var(--chth-font-rtl); --chth-font-display: var(--chth-font-rtl); }\n\n/* Shared CHTH components. Colors come from the surrounding page (currentColor) plus the brand\n   variables, so the same footer and language menu fit a dark café menu, the gym app and the\n   light shop. A site can set --chth-line, --chth-menu-bg and --chth-menu-ink to match itself. */\n\n/* Footer: one line, the CHTH logo and \"Part of CHTH\", linking to chth.wtf. */\n.chth-footer {\n  border-top: 1px solid var(--chth-line);\n  color: inherit;\n  display: flex;\n  font-family: var(--chth-font-sans);\n  font-size: 0.875rem;\n  justify-content: center;\n  line-height: 1.5;\n  padding: 1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px));\n}\n.chth-footer__brand {\n  align-items: center;\n  color: inherit;\n  display: inline-flex;\n  font-weight: 600;\n  gap: 0.6rem;\n  min-height: 2.75rem;\n  opacity: 0.8;\n  text-decoration: none;\n  transition: color 150ms ease, opacity 150ms ease;\n}\n.chth-footer__brand:hover, .chth-footer__brand:focus-visible { color: var(--chth-product-accent); opacity: 1; }\n.chth-footer__mark { color: var(--chth-product-accent); display: inline-flex; flex: none; height: 1.5rem; width: 3.3rem; }\n.chth-footer__mark svg { height: 100%; width: 100%; }\n\n/* Language menu: a round globe button in the navbar that opens the list of languages. */\n.chth-lang-menu { display: inline-block; flex: none; position: relative; }\n.chth-lang-menu > summary {\n  align-items: center;\n  border: 1px solid var(--chth-line);\n  border-radius: var(--chth-radius-full);\n  color: inherit;\n  cursor: pointer;\n  display: inline-grid;\n  height: 2.5rem;\n  justify-items: center;\n  list-style: none;\n  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 160ms cubic-bezier(0.23, 1, 0.32, 1);\n  user-select: none;\n  -webkit-user-select: none;\n  width: 2.5rem;\n}\n.chth-lang-menu > summary::-webkit-details-marker { display: none; }\n.chth-lang-menu > summary svg { height: 1.15rem; width: 1.15rem; }\n.chth-lang-menu > summary:active { transform: scale(0.92); }\n.chth-lang-menu > summary:focus-visible { outline: 2px solid var(--chth-product-accent); outline-offset: 2px; }\n.chth-lang-menu[open] > summary { border-color: var(--chth-product-accent); color: var(--chth-product-accent); }\n.chth-lang-menu__list {\n  background: var(--chth-menu-bg, Canvas);\n  border: 1px solid var(--chth-line);\n  border-radius: var(--chth-radius-lg);\n  box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.45);\n  color: var(--chth-menu-ink, CanvasText);\n  display: grid;\n  font-family: var(--chth-font-sans);\n  font-size: 0.875rem;\n  gap: 0.125rem;\n  inset-inline-end: 0;\n  min-width: 10rem;\n  padding: 0.375rem;\n  position: absolute;\n  top: calc(100% + 0.5rem);\n  transform-origin: top;\n  z-index: 50;\n}\n.chth-lang-menu[open] .chth-lang-menu__list { animation: chth-menu-in 160ms cubic-bezier(0.23, 1, 0.32, 1); }\n.chth-lang-menu__list a {\n  border-radius: var(--chth-radius-md);\n  color: inherit;\n  display: block;\n  padding: 0.55rem 0.75rem;\n  text-decoration: none;\n}\n.chth-lang-menu__list a:hover, .chth-lang-menu__list a:focus-visible { background: color-mix(in srgb, currentColor 8%, transparent); outline: none; }\n.chth-lang-menu__list a:is(:lang(fa), :lang(ar)) { font-family: var(--chth-font-rtl); letter-spacing: 0; }\n.chth-lang-menu__list a[aria-current=\"true\"] { color: var(--chth-product-accent); font-weight: 700; }\n@keyframes chth-menu-in { from { opacity: 0; transform: translateY(-4px) scale(0.97); } }\n@media (prefers-reduced-motion: reduce) { .chth-lang-menu[open] .chth-lang-menu__list { animation: none; } }\n@media (hover: hover) and (pointer: fine) {\n  .chth-lang-menu > summary:hover { background: color-mix(in srgb, currentColor 8%, transparent); }\n}\n";

/** A product's accent colors (cafe, gym, shop, hub), or the brand accent. */
export function productTheme(id) {
  const p = BRAND.products[id];
  return p ?? { accent: BRAND.color.accent, accentHover: BRAND.color.accentHover, onAccent: BRAND.color.onAccent };
}
