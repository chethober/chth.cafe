// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// A small flag for each of the five languages, as inline SVG (Windows shows no flag emoji, and
// these need no network). 3:2, drawn on a 30×20 box; CSS (.chth-flag) gives the size, corners and
// a hairline edge so white bands don't vanish on a light page. Decorative: the language's name is
// always written next to it.
//
// Persian is the Lion and Sun flag: green, white and red bands with the golden lion holding a
// sword before the rising sun. Arabic follows LOCALES (Saudi Arabia), with the shahada drawn as a
// stroke rather than lettering at this size; English is the Union Flag.

import { LOCALES } from './locales.js';

const svg = (body) => `<svg class="chth-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">${body}</svg>`;

// The lion and sun, drawn on a 20×12 box and placed in the middle of the white band
const LION_AND_SUN = '<g transform="translate(10 7.05) scale(0.5)">'
  // The sun rising behind the lion's back, with its rays
  + '<g stroke="#f5b81c" stroke-width="0.7" stroke-linecap="round"><path d="M12 0.3v1.1M15.6 1.3l-0.8 0.8M17.2 4.5h-1.1M8.4 1.3l0.8 0.8M6.8 4.5h1.1"/></g>'
  + '<circle cx="12" cy="4.5" r="2.9" fill="#f5b81c"/>'
  // Tail, then body and legs
  + '<path d="M16 6C18 5.6 18.8 4.2 18 2.8" fill="none" stroke="#c98d12" stroke-width="0.7" stroke-linecap="round"/>'
  + '<circle cx="18" cy="2.6" r="0.6" fill="#a8740a"/>'
  + '<path fill="#c98d12" d="M6.4 5.5C8.2 5 12 5 14.6 5.3C16 5.5 16.4 6.6 16.1 8.1L15.8 8.1L15.9 11H15L14.8 8.6L14 8.6L13.9 11H13L12.8 8.4C10.6 8.6 8.9 8.6 7.7 8.4L7.6 11H6.7L6.6 8.4L5.8 11H4.9L5.5 7.8C5 7.2 4.9 6.2 5.4 5.6Z"/>'
  // The mane, darker, around the head and muzzle
  + '<circle cx="5.3" cy="5" r="2.5" fill="#a8740a"/>'
  + '<circle cx="4.5" cy="4.5" r="1.5" fill="#d99a16"/>'
  + '<path fill="#d99a16" d="M3.3 4L2 4.8L3.3 5.5Z"/>'
  // The sword, raised in the right forepaw
  + '<path d="M4.9 6.7L1.6 0.9" stroke="#8a96a3" stroke-width="0.6" stroke-linecap="round"/>'
  + '<path d="M4.1 6.8L5.6 6" stroke="#8a96a3" stroke-width="0.6" stroke-linecap="round"/>'
  + '</g>';

export const FLAGS = Object.freeze({
  en: svg('<rect width="30" height="20" fill="#012169"/>'
    + '<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/>'
    + '<path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.4"/>'
    + '<path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/>'
    + '<path d="M15 0V20M0 10H30" stroke="#c8102e" stroke-width="3.4"/>'),
  fa: svg('<rect width="30" height="20" fill="#fff"/>'
    + '<rect width="30" height="6.67" fill="#239f40"/>'
    + '<rect y="13.33" width="30" height="6.67" fill="#da0000"/>'
    + LION_AND_SUN),
  ar: svg('<rect width="30" height="20" fill="#006c35"/>'
    + '<path d="M8.5 8.4c.8-1.5 1.6-1.5 2.4 0s1.6 1.5 2.4 0 1.6-1.5 2.4 0 1.6 1.5 2.4 0 1.6-1.5 2.4 0 1.6 1.5 2.4 0" fill="none" stroke="#fff" stroke-width="0.8" stroke-linecap="round"/>'
    + '<path d="M10.2 5.6v2.6M14.4 5.4v2.8M18.6 5.6v2.6" stroke="#fff" stroke-width="0.7" stroke-linecap="round"/>'
    + '<path d="M8 13.4H20.6" stroke="#fff" stroke-width="1" stroke-linecap="round"/>'
    + '<path d="M20.6 12.5v1.8M21.2 13.4h1.4" stroke="#fff" stroke-width="0.8" stroke-linecap="round"/>'),
  ru: svg('<rect width="30" height="20" fill="#d52b1e"/>'
    + '<rect width="30" height="13.33" fill="#0039a6"/>'
    + '<rect width="30" height="6.67" fill="#fff"/>'),
  es: svg('<rect width="30" height="20" fill="#aa151b"/>'
    + '<rect y="5" width="30" height="10" fill="#f1bf00"/>'),
});

/** The flag for a language code, or '' for one the kit doesn't speak. */
export const flagSvg = (code) => FLAGS[code] ?? '';

// Every language in LOCALES has a flag
for (const l of LOCALES) if (!FLAGS[l.code]) throw new Error(`chth-kit: no flag for ${l.code}`);
