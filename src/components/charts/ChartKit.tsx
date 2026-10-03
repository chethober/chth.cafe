import React, { useLayoutEffect, useRef, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

// Shared chart furniture: sizing, number formats, ticks, card + table-view toggle, tooltip.

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const grouped = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** Full money value, e.g. ₹1,284.50 or −₹320.00. */
export const money = (currency: string, value: number) =>
  `${value < 0 ? '−' : ''}${currency}${cents.format(Math.abs(value))}`;

/** Stat-tile money: exact under 10K, then auto-compact (12.9K, 4.2M). */
export const moneyShort = (currency: string, value: number) => {
  const abs = Math.abs(value);
  const body = abs >= 10_000 ? compact.format(abs) : abs >= 1_000 ? grouped.format(abs) : cents.format(abs);
  return `${value < 0 ? '−' : ''}${currency}${body}`;
};

export const tickLabel = (currency: string, value: number) =>
  `${value < 0 ? '−' : ''}${currency}${compact.format(Math.abs(value))}`;

export const count = (value: number) => grouped.format(value);

/** Clean axis ticks (0 / 500 / 1,000 …) spanning [min, max]. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (max <= min) max = min + 1;
  const raw = (max - min) / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999; v += step) {
    ticks.push(Math.round(v / step) * step);
    if (v >= max) break;
  }
  return ticks;
}

/** Column with a 4px rounded data-end and a square base on the zero line. */
export function columnPath(x: number, width: number, yBase: number, yValue: number) {
  const height = Math.abs(yBase - yValue);
  if (height < 0.5) return '';
  const r = Math.min(4, width / 2, height);
  if (yValue <= yBase) {
    return `M${x},${yBase}V${yValue + r}Q${x},${yValue} ${x + r},${yValue}H${x + width - r}Q${x + width},${yValue} ${x + width},${yValue + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yValue - r}Q${x},${yValue} ${x + r},${yValue}H${x + width - r}Q${x + width},${yValue} ${x + width},${yValue - r}V${yBase}Z`;
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  className = '',
  children
}: {
  title: string;
  subtitle?: React.ReactNode;
  legend?: React.ReactNode;
  table: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={`glass-panel viz viz-card ${className}`}>
      <figcaption className="viz-card-head">
        <div className="min-w-0">
          <h3>{title}</h3>
          {subtitle && <p className="viz-subtitle">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="viz-toggle"
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
          title={showTable ? 'Show chart' : 'Show as table'}
        >
          {showTable ? <BarChart3 className="w-4 h-4" aria-hidden /> : <Table2 className="w-4 h-4" aria-hidden />}
          <span>{showTable ? 'Chart' : 'Table'}</span>
        </button>
      </figcaption>
      {legend && !showTable && <div className="viz-legend">{legend}</div>}
      {showTable ? <div className="viz-table-wrap">{table}</div> : children}
    </figure>
  );
}

export const LegendKey = ({ color, shape = 'line' }: { color: string; shape?: 'line' | 'rect' }) => (
  <span aria-hidden className={shape === 'line' ? 'viz-key-line' : 'viz-key-rect'} style={{ background: color }} />
);

export function Tooltip({ x, align, children }: { x: number; align: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <div className="viz-tooltip" role="status" style={align === 'left' ? { left: x + 12 } : { right: `calc(100% - ${x - 12}px)` }}>
      {children}
    </div>
  );
}

export const TooltipRow = ({ color, label, value }: { color?: string; label: string; value: string }) => (
  <div className="viz-tooltip-row">
    {color ? <LegendKey color={color} /> : <span className="viz-key-spacer" />}
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

export const EmptyChart = ({ children }: { children: React.ReactNode }) => <p className="viz-empty">{children}</p>;
