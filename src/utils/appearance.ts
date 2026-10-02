import type { CSSProperties } from 'react';

export interface AppearanceSettings {
  paperTone: 'oat' | 'sage' | 'rose' | 'ivory' | 'blueprint' | 'terracotta' | 'ink' | 'lavender' | 'mint' | 'espresso';
  typography: 'editorial' | 'modern' | 'book' | 'playful' | 'geometric' | 'mono' | 'classic' | 'humanist' | 'rounded';
  bodyFont: 'jakarta' | 'outfit' | 'geometric' | 'system' | 'mono' | 'classic' | 'humanist' | 'rounded';
  borderRadius: number;
  density: 'comfortable' | 'compact';
  motion: 'playful' | 'reduced';
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  paperTone: 'oat', typography: 'editorial', bodyFont: 'jakarta', borderRadius: 2,
  density: 'comfortable', motion: 'playful'
};

export const BORDER_RADII = [0, 2, 4, 8, 12, 16, 24, 32] as const;

export const HEADING_FONTS = [
  { value: 'classic', label: 'Palatino · classic', family: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { value: 'humanist', label: 'Trebuchet · humanist', family: "'Trebuchet MS', sans-serif" },
  { value: 'rounded', label: 'Outfit · rounded', family: "'Outfit', system-ui, sans-serif" },
  { value: 'editorial', label: 'Georgia · editorial', family: "Georgia, 'Times New Roman', serif" },
  { value: 'modern', label: 'Plus Jakarta Sans · modern', family: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { value: 'book', label: 'Libre Baskerville · bookish', family: "'Libre Baskerville', Georgia, serif" },
  { value: 'playful', label: 'Fraunces · expressive', family: "'Fraunces', Georgia, serif" },
  { value: 'geometric', label: 'Space Grotesk · geometric', family: "'Space Grotesk', system-ui, sans-serif" },
  { value: 'mono', label: 'JetBrains Mono · typewriter', family: "'JetBrains Mono', 'Courier New', monospace" }
] as const;
export const BODY_FONTS = [
  { value: 'classic', label: 'Palatino', family: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { value: 'humanist', label: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
  { value: 'rounded', label: 'Arial Rounded', family: "'Arial Rounded MT Bold', 'Outfit', sans-serif" },
  { value: 'jakarta', label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { value: 'outfit', label: 'Outfit', family: "'Outfit', system-ui, sans-serif" },
  { value: 'geometric', label: 'Space Grotesk', family: "'Space Grotesk', system-ui, sans-serif" },
  { value: 'system', label: 'System sans', family: 'system-ui, -apple-system, sans-serif' },
  { value: 'mono', label: 'JetBrains Mono', family: "'JetBrains Mono', 'Courier New', monospace" }
] as const;
export const PAPER_TONE_OPTIONS = [
  { value: 'oat', label: 'Oat', color: '#f3eddf' }, { value: 'sage', label: 'Sage', color: '#e9eee3' },
  { value: 'rose', label: 'Rose', color: '#f2e7e1' }, { value: 'ivory', label: 'Ivory', color: '#f6f4ee' },
  { value: 'blueprint', label: 'Blueprint', color: '#e7edf4' }, { value: 'terracotta', label: 'Terracotta', color: '#eee2d1' },
  { value: 'ink', label: 'Ink', color: '#e9e7e2' },
  { value: 'lavender', label: 'Lavender', color: '#eee8f4' }, { value: 'mint', label: 'Mint', color: '#e5f1eb' },
  { value: 'espresso', label: 'Espresso', color: '#eadfd6' }
] as const;
export const THEME_PRESETS: Array<{
  name: string; description: string; accent: string;
  appearance: Pick<AppearanceSettings, 'paperTone' | 'typography' | 'bodyFont' | 'borderRadius'>;
}> = [
  { name: 'Lavender lounge', description: 'Lilac paper & rounded type', accent: '#765492', appearance: { paperTone: 'lavender', typography: 'rounded', bodyFont: 'outfit', borderRadius: 24 } },
  { name: 'Mint market', description: 'Fresh greens & friendly lettering', accent: '#38765d', appearance: { paperTone: 'mint', typography: 'humanist', bodyFont: 'humanist', borderRadius: 12 } },
  { name: 'Espresso club', description: 'Coffee tones & classic serif', accent: '#81583c', appearance: { paperTone: 'espresso', typography: 'classic', bodyFont: 'classic', borderRadius: 4 } },
  { name: 'Café zine', description: 'Oat paper & editorial type', accent: '#806331', appearance: { paperTone: 'oat', typography: 'editorial', bodyFont: 'jakarta', borderRadius: 2 } },
  { name: 'Botanical notebook', description: 'Sage paper & softer corners', accent: '#47704b', appearance: { paperTone: 'sage', typography: 'book', bodyFont: 'outfit', borderRadius: 8 } },
  { name: 'Rose letterpress', description: 'Warm blush & expressive type', accent: '#9d5155', appearance: { paperTone: 'rose', typography: 'playful', bodyFont: 'jakarta', borderRadius: 2 } },
  { name: 'Ivory studio', description: 'Quiet neutrals & clean lines', accent: '#60655b', appearance: { paperTone: 'ivory', typography: 'modern', bodyFont: 'system', borderRadius: 8 } },
  { name: 'Indigo blueprint', description: 'Blue ink & geometric lettering', accent: '#3d648b', appearance: { paperTone: 'blueprint', typography: 'geometric', bodyFont: 'geometric', borderRadius: 0 } },
  { name: 'Terracotta journal', description: 'Earth tones & bookish details', accent: '#a25c37', appearance: { paperTone: 'terracotta', typography: 'book', bodyFont: 'outfit', borderRadius: 16 } },
  { name: 'Midnight typewriter', description: 'Cool charcoal & mono type', accent: '#646b85', appearance: { paperTone: 'ink', typography: 'mono', bodyFont: 'jakarta', borderRadius: 0 } }
];

export function parseAppearance(raw?: string | null): AppearanceSettings {
  try {
    const value = JSON.parse(raw || '{}');
    return {
      paperTone: PAPER_TONE_OPTIONS.some(option => option.value === value?.paperTone) ? value.paperTone : DEFAULT_APPEARANCE.paperTone,
      typography: HEADING_FONTS.some(option => option.value === value?.typography) ? value.typography : DEFAULT_APPEARANCE.typography,
      bodyFont: BODY_FONTS.some(option => option.value === value?.bodyFont) ? value.bodyFont : DEFAULT_APPEARANCE.bodyFont,
      borderRadius: (BORDER_RADII as readonly number[]).includes(value?.borderRadius) ? value.borderRadius : DEFAULT_APPEARANCE.borderRadius,
      density: ['comfortable', 'compact'].includes(value?.density) ? value.density : DEFAULT_APPEARANCE.density,
      motion: ['playful', 'reduced'].includes(value?.motion) ? value.motion : DEFAULT_APPEARANCE.motion
    };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}

const PAPER_TONES = {
  lavender: { light: '#eee8f4', lightSheet: '#f9f5fc', lightInk: '#372842', lightMuted: '#766181', lightRule: '#b6a1c4', dark: '#261c30', darkSheet: '#31253c', darkInk: '#efe3f8', darkMuted: '#baa6c8', darkRule: '#655175' },
  mint: { light: '#e5f1eb', lightSheet: '#f2faf5', lightInk: '#243b30', lightMuted: '#567564', lightRule: '#9cbdaa', dark: '#192a22', darkSheet: '#23382d', darkInk: '#e0f2e7', darkMuted: '#9dbdaa', darkRule: '#4b705c' },
  espresso: { light: '#eadfd6', lightSheet: '#f8eee6', lightInk: '#39291f', lightMuted: '#795e4c', lightRule: '#b49a85', dark: '#241a15', darkSheet: '#33251d', darkInk: '#f3e2d4', darkMuted: '#bea18a', darkRule: '#70543e' },
  oat: { light: '#f3eddf', lightSheet: '#faf6eb', lightInk: '#332b22', lightMuted: '#736653', lightRule: '#b6a68e', dark: '#241f19', darkSheet: '#2b251e', darkInk: '#f2e6cf', darkMuted: '#baac97', darkRule: '#625647' },
  sage: { light: '#e9eee3', lightSheet: '#f4f7ee', lightInk: '#293328', lightMuted: '#596853', lightRule: '#a2b09b', dark: '#1c251e', darkSheet: '#253029', darkInk: '#e3edda', darkMuted: '#a9b9a1', darkRule: '#50644f' },
  rose: { light: '#f2e7e1', lightSheet: '#faf2ec', lightInk: '#3b2b28', lightMuted: '#7b625b', lightRule: '#bda098', dark: '#2b1f1e', darkSheet: '#352726', darkInk: '#f3e1d9', darkMuted: '#c2a59b', darkRule: '#765a52' },
  ivory: { light: '#f6f4ee', lightSheet: '#fdfcf8', lightInk: '#30312c', lightMuted: '#6a6c60', lightRule: '#b5b7a9', dark: '#222221', darkSheet: '#2c2d29', darkInk: '#eeeee3', darkMuted: '#b9baab', darkRule: '#606257' },
  blueprint: { light: '#e7edf4', lightSheet: '#f4f7fb', lightInk: '#25374b', lightMuted: '#5c7087', lightRule: '#9daec2', dark: '#132538', darkSheet: '#1d3045', darkInk: '#e0edf8', darkMuted: '#a5bbd0', darkRule: '#49617b' },
  terracotta: { light: '#eee2d1', lightSheet: '#faf0e1', lightInk: '#422e21', lightMuted: '#80634d', lightRule: '#b89a7e', dark: '#2f221c', darkSheet: '#3b2a20', darkInk: '#f5e4cf', darkMuted: '#c5a98d', darkRule: '#7a5b44' },
  ink: { light: '#e9e7e2', lightSheet: '#f5f4f0', lightInk: '#292c36', lightMuted: '#666976', lightRule: '#a7a7b0', dark: '#151619', darkSheet: '#202127', darkInk: '#e7e6df', darkMuted: '#afb0bb', darkRule: '#545662' }
} as const;

export function appearanceVariables(appearance: AppearanceSettings): CSSProperties & Record<string, string> {
  const tone = PAPER_TONES[appearance.paperTone];
  const compact = appearance.density === 'compact';
  return {
    '--cafe-paper-light': tone.light, '--cafe-sheet-light': tone.lightSheet,
    '--cafe-ink-light': tone.lightInk, '--cafe-muted-light': tone.lightMuted, '--cafe-rule-light': tone.lightRule,
    '--cafe-paper-dark': tone.dark, '--cafe-sheet-dark': tone.darkSheet,
    '--cafe-ink-dark': tone.darkInk, '--cafe-muted-dark': tone.darkMuted, '--cafe-rule-dark': tone.darkRule,
    '--font-heading': HEADING_FONTS.find(font => font.value === appearance.typography)!.family,
    '--menu-serif': HEADING_FONTS.find(font => font.value === appearance.typography)!.family,
    '--font-sans': BODY_FONTS.find(font => font.value === appearance.bodyFont)!.family,
    '--control-radius': `${appearance.borderRadius}px`,
    '--workspace-panel-padding': compact ? '16px' : '24px', '--workspace-gap': compact ? '16px' : '24px',
    '--workspace-row-padding': compact ? '9px' : '14px', '--workspace-control-height': compact ? '40px' : '44px'
  };
}

export function applyAppearance(raw: string | null | undefined): void {
  const appearance = parseAppearance(raw);
  for (const [name, value] of Object.entries(appearanceVariables(appearance))) document.documentElement.style.setProperty(name, value);
  document.documentElement.dataset.motion = appearance.motion;
  document.documentElement.dataset.density = appearance.density;
}
