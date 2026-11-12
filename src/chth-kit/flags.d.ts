// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale } from './locales.js';
/** Each language's flag file in kit/flags (fa is the Lion and Sun flag, a PNG). */
export const FLAG_FILES: Readonly<Record<Locale, string>>;
/** The languages that have a flag file in kit/flags (real flag-icons artwork, MIT). */
export const FLAG_CODES: readonly Locale[];
/** The flag file's URL under `base` (where the site serves kit/flags), or '' when there is none. */
export function flagSrc(code: string, base?: string | null): string;
