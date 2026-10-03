import React, { useState } from 'react';
import { EmptyChart, LegendKey, Tooltip, TooltipRow } from './ChartKit';

// Ranked horizontal bars: one series, one colour, value at the bar tip.
export function BarList({
  rows,
  color,
  format,
  detail,
  empty
}: {
  rows: Array<{ label: string; value: number }>;
  color: string;
  format: (value: number) => string;
  detail?: (index: number) => Array<{ label: string; value: string }>;
  empty: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (rows.length === 0) return <EmptyChart>{empty}</EmptyChart>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="viz-barlist">
      {rows.map((row, i) => {
        const pct = (row.value / max) * 100;
        return (
          <li
            key={row.label}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            data-active={active === i || undefined}
          >
            <span className="viz-barlist-label" title={row.label}>{row.label}</span>
            <span className="viz-barlist-track">
              <span className="viz-bar" style={{ width: `${pct}%`, background: color }} />
              <span className="viz-barlist-value">{format(row.value)}</span>
              {active === i && detail && (
                <Tooltip x={0} align="left">
                  <div className="viz-tooltip-title">{row.label}</div>
                  {detail(i).map((d) => <TooltipRow key={d.label} label={d.label} value={d.value} />)}
                </Tooltip>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Part-to-whole as one 100% stacked bar, 2px surface gaps, legend rows carrying every value.
export function ShareBar({
  parts,
  format
}: {
  parts: Array<{ label: string; value: number; color: string; note?: string }>;
  format: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total <= 0) return <EmptyChart>No completed sales in this range.</EmptyChart>;
  const share = (v: number) => `${((v / total) * 100).toFixed(v / total < 0.1 && v > 0 ? 1 : 0)}%`;
  const visible = parts.map((p, i) => ({ ...p, i })).filter((p) => p.value > 0);
  return (
    <div className="viz-share">
      <div className="viz-sharebar" onPointerLeave={() => setActive(null)}>
        {visible.map((p) => (
          <span
            key={p.label}
            className="viz-share-seg"
            style={{ flexGrow: p.value, background: p.color }}
            onPointerEnter={() => setActive(p.i)}
            data-dim={active !== null && active !== p.i ? true : undefined}
          />
        ))}
      </div>
      <ul className="viz-share-legend">
        {parts.map((p, i) => (
          <li
            key={p.label}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            data-active={active === i || undefined}
          >
            <LegendKey color={p.color} shape="rect" />
            <span className="viz-share-name">{p.label}</span>
            <span className="viz-share-note">{p.note}</span>
            <strong>{format(p.value)}</strong>
            <span className="viz-share-pct">{share(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Trend-only sparkline: quiet de-emphasis line, current period marked in the accent.
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => 4 + (i * (w - 8)) / (values.length - 1);
  const y = (v: number) => h - 5 - ((v - min) / (max - min || 1)) * (h - 10);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  return (
    <svg className="viz-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} fill="none" stroke="var(--viz-quiet)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
