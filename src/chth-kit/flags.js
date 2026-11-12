// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The flag beside each language in the switcher. The flags are real artwork, not drawn here:
// kit/flags/*.svg, from the flag-icons project (MIT, kit/flags/LICENSE-flag-icons), synced into
// each site's static files (scripts/kit.mjs, `flags` targets) and shown as lazy <img>s, so a page
// only fetches them when someone opens the menu. Persian is the Lion and Sun flag (fa.png, the
// pre-1979 state flag).

/** Each language's flag file in kit/flags. */
export const FLAG_FILES = Object.freeze({ en: 'en.svg', fa: 'fa.png', ar: 'ar.svg', ru: 'ru.svg', es: 'es.svg' });

/** The languages that have a flag file in kit/flags. */
export const FLAG_CODES = Object.freeze(Object.keys(FLAG_FILES));

/** The flag file's URL under `base` (where the site serves kit/flags), or '' when there is none. */
export function flagSrc(code, base) {
  if (!base || !FLAG_FILES[code]) return '';
  return `${String(base).replace(/\/+$/, '')}/${FLAG_FILES[code]}`;
}
