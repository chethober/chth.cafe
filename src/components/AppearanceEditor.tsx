import React from 'react';
import { AppearanceSettings, DEFAULT_APPEARANCE, HEADING_FONTS, BODY_FONTS, BORDER_RADII, PAPER_TONE_OPTIONS, THEME_PRESETS, appearanceVariables } from '../utils/appearance';
import { Button, Card, Field, Select, ToggleRow } from '../ui';

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
  return (
    <Card
      title="Appearance"
      description="One look for the public menu, admin, and daily panel. Pick a theme, adjust it, then save."
      actions={<Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(DEFAULT_APPEARANCE)}>Reset</Button>}
    >
      <div className="ws-form appearance-settings">
        <fieldset disabled={disabled} className="ws-fieldset ws-field">
          <legend className="ws-label" style={{ marginBottom: 8 }}>Themes</legend>
          <div className="appearance-theme-grid">{THEME_PRESETS.map(preset => {
            const selected = Object.entries(preset.appearance).every(([key, value]) => appearance[key as keyof AppearanceSettings] === value) && accent.toLowerCase() === preset.accent;
            return (
              <button type="button" key={preset.name} aria-pressed={selected} onClick={() => onPreset(preset)} className="appearance-theme-card" style={appearanceVariables({ ...appearance, ...preset.appearance })}>
                <span className="appearance-theme-sample" aria-hidden="true">Aa<span style={{ backgroundColor: preset.accent }} /></span>
                <span className="appearance-theme-name">{preset.name}</span>
                <span className="appearance-theme-description">{preset.description}</span>
              </button>
            );
          })}</div>
          <span className="ws-hint" style={{ marginTop: 8 }}>Themes set paper, fonts, accent, and corners. Spacing and motion stay as you chose them.</span>
        </fieldset>
        <div className="ws-grid ws-grid-2">
          <fieldset disabled={disabled} className="ws-fieldset ws-form">
            <legend className="sr-only">Fine-tune</legend>
            <div className="ws-form-row cols-2">
              <Field label="Paper tone">{id => (
                <Select id={id} value={appearance.paperTone} onChange={e => onChange({ paperTone: e.target.value as AppearanceSettings['paperTone'] })}>
                  {PAPER_TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}</Field>
              <Field label="Corners">{id => (
                <Select id={id} value={appearance.borderRadius} onChange={e => onChange({ borderRadius: Number(e.target.value) })}>
                  {BORDER_RADII.map(v => <option key={v} value={v}>{v === 0 ? 'Square' : 'Rounded'} · {v}px</option>)}
                </Select>
              )}</Field>
              <Field label="Heading font">{id => (
                <Select id={id} value={appearance.typography} onChange={e => onChange({ typography: e.target.value as AppearanceSettings['typography'] })}>
                  {HEADING_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              )}</Field>
              <Field label="Body font">{id => (
                <Select id={id} value={appearance.bodyFont} onChange={e => onChange({ bodyFont: e.target.value as AppearanceSettings['bodyFont'] })}>
                  {BODY_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              )}</Field>
              <Field label="Spacing">{id => (
                <Select id={id} value={appearance.density} onChange={e => onChange({ density: e.target.value as AppearanceSettings['density'] })}>
                  <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
                </Select>
              )}</Field>
            </div>
            <ToggleRow title="Playful motion" description="Dice rolls, ticket stamps, and small transitions. Device reduced-motion settings always win."
              checked={appearance.motion === 'playful'} onChange={v => onChange({ motion: v ? 'playful' : 'reduced' })} disabled={disabled} />
          </fieldset>
          <div className="appearance-preview" style={{ ...appearanceVariables(appearance), '--brand-primary': accent, borderRadius: 'var(--ws-radius-lg)' } as React.CSSProperties} aria-label="Appearance preview">
            <div className="appearance-preview-kicker">{cafeName} / a little preview</div>
            <h3>A little pause.</h3>
            <p>Same paper. Same ink. Every corner of the café.</p>
            <div className="appearance-preview-row"><span>Today's ledger</span><span>01</span></div>
            <div className="appearance-preview-row"><span>Your next usual</span><span>{currency}120.00</span></div>
            <div className="appearance-preview-bottom"><span>Made to feel familiar.</span><span className="appearance-preview-ticket">Order ticket</span></div>
          </div>
        </div>
      </div>
    </Card>
  );
}
