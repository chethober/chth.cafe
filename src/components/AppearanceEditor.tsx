import React from 'react';
import { AppearanceSettings, DEFAULT_APPEARANCE, HEADING_FONTS, BODY_FONTS, BORDER_RADII, PAPER_TONE_OPTIONS, THEME_PRESETS, appearanceVariables } from '../utils/appearance';

interface AppearanceEditorProps {
  appearance: AppearanceSettings;
  cafeName: string;
  currency: string;
  accent: string;
  disabled: boolean;
  onChange: (partial: Partial<AppearanceSettings>) => void;
  onPreset: (preset: typeof THEME_PRESETS[number]) => void;
}

export function AppearanceEditor({ appearance, cafeName, currency, accent, disabled, onChange, onPreset }: AppearanceEditorProps) {
  const controlClass = 'w-full bg-zinc-900 border border-zinc-800 p-3 text-zinc-100';
  return <section className="glass-panel appearance-settings space-y-5" aria-labelledby="appearance-heading">
    <div className="flex flex-wrap justify-between items-start gap-3 border-b border-zinc-800 pb-4">
      <div><h2 id="appearance-heading">Paper & ink</h2><p className="text-sm text-zinc-400 mt-2">One look for the whole café. Start with a theme, make it yours, then save.</p></div>
      <button type="button" disabled={disabled} onClick={() => onChange(DEFAULT_APPEARANCE)} className="appearance-reset">Reset appearance</button>
    </div>
    <fieldset disabled={disabled}><legend className="text-sm text-zinc-300 mb-3 font-semibold">Theme presets</legend>
      <div className="appearance-theme-grid">{THEME_PRESETS.map(preset => {
        const selected = Object.entries(preset.appearance).every(([key, value]) => appearance[key as keyof AppearanceSettings] === value) && accent.toLowerCase() === preset.accent;
        return <button type="button" key={preset.name} aria-pressed={selected} onClick={() => onPreset(preset)} className="appearance-theme-card" style={appearanceVariables({ ...appearance, ...preset.appearance })}>
          <span className="appearance-theme-sample" aria-hidden="true">Aa<span style={{ backgroundColor: preset.accent }} /></span><span className="appearance-theme-name">{preset.name}</span><span className="appearance-theme-description">{preset.description}</span>
        </button>;
      })}</div>
      <p className="text-xs text-zinc-400 mt-3">Themes set the paper, fonts, accent, and corners. Spacing and motion stay as you chose them.</p>
    </fieldset>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <fieldset disabled={disabled} className="space-y-5 min-w-0"><legend className="sr-only">Shared appearance settings</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label htmlFor="appearance-tone" className="block text-sm text-zinc-300 font-semibold mb-2">Paper tone</label><select id="appearance-tone" value={appearance.paperTone} onChange={event => onChange({ paperTone: event.target.value as AppearanceSettings['paperTone'] })} className={controlClass}>{PAPER_TONE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div><label htmlFor="appearance-radius" className="block text-sm text-zinc-300 font-semibold mb-2">Border corners</label><select id="appearance-radius" value={appearance.borderRadius} onChange={event => onChange({ borderRadius: Number(event.target.value) })} className={controlClass}>{BORDER_RADII.map(value => <option key={value} value={value}>{value === 0 ? 'Square' : 'Rounded'} · {value}px</option>)}</select></div>
          <div><label htmlFor="appearance-type" className="block text-sm text-zinc-300 font-semibold mb-2">Heading font</label><select id="appearance-type" value={appearance.typography} onChange={event => onChange({ typography: event.target.value as AppearanceSettings['typography'] })} className={controlClass}>{HEADING_FONTS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
          <div><label htmlFor="appearance-body" className="block text-sm text-zinc-300 font-semibold mb-2">Body font</label><select id="appearance-body" value={appearance.bodyFont} onChange={event => onChange({ bodyFont: event.target.value as AppearanceSettings['bodyFont'] })} className={controlClass}>{BODY_FONTS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
          <div><label htmlFor="appearance-density" className="block text-sm text-zinc-300 font-semibold mb-2">Layout spacing</label><select id="appearance-density" value={appearance.density} onChange={event => onChange({ density: event.target.value as AppearanceSettings['density'] })} className={controlClass}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
        </div>
        <label className="appearance-motion"><input type="checkbox" checked={appearance.motion === 'playful'} onChange={event => onChange({ motion: event.target.checked ? 'playful' : 'reduced' })} /><span><strong className="block text-sm text-zinc-300">Playful motion</strong><span className="text-xs text-zinc-400">Dice rolls, ticket stamps, and small transitions. Device motion preferences are always respected.</span></span></label>
      </fieldset>
      <div className="appearance-preview" style={{ ...appearanceVariables(appearance), '--brand-primary': accent } as React.CSSProperties} aria-label="Appearance preview">
        <div className="appearance-preview-kicker">{cafeName} / a little preview</div><h3>A little pause.</h3><p>Same paper. Same ink. Every corner of the café.</p>
        <div className="appearance-preview-row"><span>Today's ledger</span><span>01</span></div><div className="appearance-preview-row"><span>Your next usual</span><span>{currency}120.00</span></div>
        <div className="appearance-preview-bottom"><span>Made to feel familiar.</span><span className="appearance-preview-ticket">Order ticket</span></div>
      </div>
    </div>
  </section>;
}
