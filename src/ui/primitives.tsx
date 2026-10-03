import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Search, X, Minus, Plus } from 'lucide-react';

type Tone = 'neutral' | 'positive' | 'danger' | 'warning' | 'info' | 'accent';
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- Buttons */

export type ButtonVariant = 'secondary' | 'primary' | 'accent' | 'ghost' | 'tonal' | 'danger' | 'danger-ghost';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  block?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, loading, className, children, type = 'button', disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('ws-btn', className)}
      data-variant={variant}
      data-size={size}
      data-block={block || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children'> {
  label: string;
  children: React.ReactNode;
}
export function IconButton({ label, children, variant = 'ghost', size = 'sm', className, ...rest }: IconButtonProps) {
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} className={cx('ws-icon-btn', className)} {...rest}>
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------------- Page */

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="ws-page">{children}</div>;
}

/** The shell's current section, so page headers can carry the menu-style eyebrow without each page passing it. */
export const PageContext = React.createContext<{ icon: React.ComponentType<{ className?: string }>; eyebrow: string } | null>(null);

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  const page = React.useContext(PageContext);
  return (
    <header className="ws-page-header">
      <div>
        {page && <span className="ws-eyebrow"><span aria-hidden="true" style={{ display: 'contents' }}><page.icon /></span>{page.eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ws-page-actions">{actions}</div>}
    </header>
  );
}

export function Section({ id, title, description, actions, children }: {
  id?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="ws-section">
      <div className="ws-section-head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------- Card */

interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  flush?: boolean;
  as?: 'section' | 'div' | 'article';
}
export function Card({ title, description, actions, footer, flush, as = 'section', children, className, ...rest }: CardProps) {
  const Tag = as;
  return (
    <Tag className={cx('ws-card', className)} {...rest}>
      {(title || actions) && (
        <div className="ws-card-head">
          <div style={{ minWidth: 0 }}>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="ws-card-actions">{actions}</div>}
        </div>
      )}
      <div className={cx('ws-card-body', flush && 'flush')}>{children}</div>
      {footer && <div className="ws-card-foot">{footer}</div>}
    </Tag>
  );
}

/* ------------------------------------------------------------------- Stats */

export function StatGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: number }) {
  return <div className="ws-stats" style={{ '--cols': columns } as React.CSSProperties}>{children}</div>;
}

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}
export function Stat({ label, value, hint, icon, tone = 'neutral', active, onClick }: StatProps) {
  const content = (
    <>
      <span className="ws-stat-label">{label}{icon}</span>
      <span className="ws-stat-value">{value}</span>
      {hint && <span className="ws-stat-hint">{hint}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className="ws-stat" data-tone={tone} data-active={active || undefined} aria-pressed={active} onClick={onClick}>{content}</button>
  ) : (
    <div className="ws-stat" data-tone={tone}>{content}</div>
  );
}

/* ------------------------------------------------------------------- Badge */

export function Badge({ tone = 'neutral', dot, icon, children }: { tone?: Tone | 'solid'; dot?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="ws-badge" data-tone={tone}>
      {dot && <span className="ws-badge-dot" aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Notice */

const NOTICE_ICONS = { neutral: Info, info: Info, positive: CheckCircle2, danger: AlertCircle, warning: AlertTriangle, accent: Info };
export function Notice({ tone = 'info', children, action, role }: { tone?: Tone; children: React.ReactNode; action?: React.ReactNode; role?: 'status' | 'alert' }) {
  const Icon = NOTICE_ICONS[tone];
  return (
    <div className="ws-notice" data-tone={tone} role={role ?? (tone === 'danger' ? 'alert' : 'status')}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Empty */

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ws-empty">
      {icon && <div className="ws-empty-icon" aria-hidden="true">{icon}</div>}
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Fields */

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  aside?: React.ReactNode;
  className?: string;
  children: (id: string, describedBy?: string) => React.ReactNode;
}
/** Label + control + hint/error. Children receive the generated id so labels always associate. */
export function Field({ label, hint, error, optional, aside, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cx('ws-field', className)}>
      <label htmlFor={id} className="ws-label">
        <span>{label}{optional && <span className="ws-optional"> (optional)</span>}</span>
        {aside}
      </label>
      {children(id, hintId)}
      {error ? <span id={hintId} className="ws-error-text">{error}</span> : hint ? <span id={hintId} className="ws-hint">{hint}</span> : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('ws-input', className)} {...rest} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx('ws-input', className)} {...rest} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('ws-input', className)} {...rest} />;
});

/** Text field with a leading symbol (e.g. currency). */
export function AffixInput({ affix, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { affix: React.ReactNode }) {
  return (
    <div className="ws-input-affix">
      <span className="ws-affix" aria-hidden="true">{affix}</span>
      <Input {...rest} />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', className }: {
  value: string; onChange: (value: string) => void; placeholder?: string; label?: string; className?: string;
}) {
  return (
    <div className={cx('ws-input-wrap', className)}>
      <Search aria-hidden="true" />
      <Input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {value && (
        <span className="ws-input-suffix">
          <IconButton label="Clear search" onClick={() => onChange('')}><X /></IconButton>
        </span>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="ws-switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="ws-switch-track" aria-hidden="true" />
      <span className="ws-switch-thumb" aria-hidden="true" />
    </span>
  );
}

export function ToggleRow({ title, description, icon, checked, onChange, disabled }: {
  title: string; description?: string; icon?: React.ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="ws-toggle-row">
      <span style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
        {icon && <span style={{ color: 'var(--ws-muted)', marginTop: 2 }}>{icon}</span>}
        <span><strong>{title}</strong>{description && <span className="ws-hint">{description}</span>}</span>
      </span>
      <span className="ws-switch">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <span className="ws-switch-track" aria-hidden="true" />
        <span className="ws-switch-thumb" aria-hidden="true" />
      </span>
    </label>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="ws-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/* --------------------------------------------------------------- Segmented */

export interface SegmentOption<T extends string> { value: T; label: React.ReactNode; count?: number; icon?: React.ReactNode }
/** iOS-style segmented control: a thumb slides to the chosen option and retargets mid-flight. */
export function Segmented<T extends string>({ options, value, onChange, label, block }: {
  options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; label: string; block?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const place = () => {
      const active = root.querySelector<HTMLElement>('button[aria-pressed="true"]');
      if (!active) return;
      root.style.setProperty('--x', `${active.offsetLeft}px`);
      root.style.setProperty('--w', `${active.offsetWidth}px`);
    };
    place();
    const raf = requestAnimationFrame(() => setReady(true));
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [value, options.length]);
  return (
    <div ref={rootRef} className="ws-segmented" role="group" aria-label={label} data-block={block || undefined} data-ready={ready}>
      <span className="ws-segmented-thumb" aria-hidden="true" />
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.icon}
          {option.label}
          {option.count !== undefined && <span className="ws-seg-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Chips */

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; label: string;
}) {
  return (
    <div className="ws-chips" role="group" aria-label={label}>
      {options.map(option => (
        <button key={option.value} type="button" className="ws-chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.icon}
          {option.label}
          {option.count !== undefined && <span className="ws-chip-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- List */

export function List({ children, maxHeight, label }: { children: React.ReactNode; maxHeight?: number; label?: string }) {
  return (
    <ul className="ws-list" aria-label={label} data-scroll={maxHeight ? '' : undefined} style={maxHeight ? ({ '--max-h': `${maxHeight}px` } as React.CSSProperties) : undefined}>
      {children}
    </ul>
  );
}

interface ListItemProps {
  lead?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trail?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  dim?: boolean;
  label?: string;
}
/** A row: lead visual, title + meta, trailing value, row actions. Clickable rows are keyboard reachable. */
export function ListItem({ lead, title, subtitle, trail, actions, onClick, dim, label }: ListItemProps) {
  return (
    <li
      className="ws-list-item"
      data-interactive={onClick ? '' : undefined}
      data-dim={dim || undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onClick(); } } : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={label}
    >
      {lead && <div className="ws-list-lead">{lead}</div>}
      <div className="ws-list-main">
        <div className="ws-list-title">{title}</div>
        {subtitle && <div className="ws-list-sub">{subtitle}</div>}
      </div>
      {trail && <div className="ws-list-trail">{trail}</div>}
      {actions && <div className="ws-list-actions" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{actions}</div>}
    </li>
  );
}

/* ------------------------------------------------------------------- Table */

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
}
export function DataTable<T>({ columns, rows, rowKey, caption, maxHeight, empty, note }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption?: string; maxHeight?: number; empty?: React.ReactNode; note?: React.ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <>
      <div className="ws-table-wrap" style={maxHeight ? ({ '--max-h': `${maxHeight}px` } as React.CSSProperties) : undefined}>
        <table className="ws-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead><tr>{columns.map(c => <th key={c.key} scope="col" data-align={c.align}>{c.header}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={rowKey(row)}>{columns.map(c => <td key={c.key} data-align={c.align}>{c.render(row)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <div className="ws-table-note">{note}</div>}
    </>
  );
}

/* ------------------------------------------------------------------- Meter */

export function Meter({ segments, size, label }: { segments: { value: number; tone: Tone | 'muted' | 'ink'; label?: string }[]; size?: 'lg'; label: string }) {
  const total = Math.max(segments.reduce((sum, s) => sum + s.value, 0), 1);
  return (
    <div className="ws-meter" data-size={size} role="img" aria-label={label}>
      {segments.map((s, i) => s.value > 0 && (
        <span key={i} data-tone={s.tone} title={s.label} style={{ width: `${(s.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

/** Single-value progress (0–1). */
export function Progress({ value, tone = 'accent', label }: { value: number; tone?: Tone | 'muted' | 'ink'; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ws-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <span data-tone={tone} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------------- Stepper */

export function Stepper({ value, onDecrement, onIncrement, label }: { value: React.ReactNode; onDecrement: () => void; onIncrement: () => void; label: string }) {
  return (
    <div className="ws-stepper" role="group" aria-label={label}>
      <button type="button" onClick={onDecrement} aria-label={`Decrease ${label}`}><Minus /></button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={onIncrement} aria-label={`Increase ${label}`}><Plus /></button>
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */

export function KeyValue({ items, total }: { items: { label: React.ReactNode; value: React.ReactNode; tone?: 'positive' | 'danger' }[]; total?: { label: React.ReactNode; value: React.ReactNode } }) {
  return (
    <>
      <dl className="ws-kv">
        {items.map((item, i) => (
          <React.Fragment key={i}><dt>{item.label}</dt><dd data-tone={item.tone}>{item.value}</dd></React.Fragment>
        ))}
      </dl>
      {total && <dl className="ws-kv ws-kv-total"><dt>{total.label}</dt><dd>{total.value}</dd></dl>}
    </>
  );
}

export function Avatar({ name, tone, size }: { name: string; tone?: 'positive'; size?: 'lg' }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
  return <span className="ws-avatar" data-tone={tone} data-size={size} aria-hidden="true">{letters}</span>;
}

export function Amount({ children, tone }: { children: React.ReactNode; tone?: 'positive' | 'danger' }) {
  return <span className="ws-amount" data-tone={tone}>{children}</span>;
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean; value?: React.ReactNode }[] }) {
  return (
    <div className="ws-legend">
      {items.map(item => (
        <span key={item.label}>
          <span className={item.line ? 'ws-swatch-line' : 'ws-swatch'} style={{ background: item.color }} aria-hidden="true" />
          {item.label}
          {item.value !== undefined && <strong style={{ color: 'var(--ws-ink)' }}>{item.value}</strong>}
        </span>
      ))}
    </div>
  );
}
