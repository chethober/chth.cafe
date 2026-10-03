import React, { useState } from 'react';
import type { Bucket } from '../../utils/financeSeries';
import { columnPath, EmptyChart, niceTicks, tickLabel, Tooltip, TooltipRow, useElementWidth, money } from './ChartKit';

// Revenue and expenses as two lines, with net profit as a diverging column strip
// beneath on the same x positions. One crosshair drives both plots and the tooltip.

const LINE_HEIGHT = 220;
const NET_HEIGHT = 112;
const AXIS_BAND = 24;
const TOP = 12;
const RIGHT = 12;

export const SERIES = [
  { key: 'revenue' as const, label: 'Revenue', color: 'var(--viz-s1)' },
  { key: 'expenses' as const, label: 'Expenses', color: 'var(--viz-s2)' }
];

export function TrendChart({ buckets, granularity, currency }: { buckets: Bucket[]; granularity: 'day' | 'week' | 'month'; currency: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const hasData = buckets.some((b) => b.revenue || b.expenses);
  const yTicks = niceTicks(0, Math.max(...buckets.flatMap((b) => [b.revenue, b.expenses]), 100));
  const yMax = yTicks[yTicks.length - 1];
  const netTicks = niceTicks(Math.min(0, ...buckets.map((b) => b.net)), Math.max(0, ...buckets.map((b) => b.net), 100), 2);
  const netMin = netTicks[0];
  const netMax = netTicks[netTicks.length - 1];

  const left = Math.max(...yTicks.concat(netTicks).map((t) => tickLabel(currency, t).length)) * 7 + 12;
  const plotWidth = Math.max(width - left - RIGHT, 10);
  const n = buckets.length;
  const step = n > 1 ? plotWidth / (n - 1) : plotWidth;
  // Columns sit centred on each point, so pad the line plot by half a slot to keep them inside.
  const pad = Math.min(step / 2, 14);
  const xAt = (i: number) => left + pad + (n > 1 ? (i * (plotWidth - pad * 2)) / (n - 1) : (plotWidth - pad * 2) / 2);
  const slot = n > 1 ? (plotWidth - pad * 2) / (n - 1) : plotWidth;

  const plotBottom = LINE_HEIGHT - AXIS_BAND;
  const yAt = (v: number) => plotBottom - (v / yMax) * (plotBottom - TOP);
  const netTop = 8;
  const netBottom = NET_HEIGHT - 8;
  const netAt = (v: number) => netBottom - ((v - netMin) / (netMax - netMin || 1)) * (netBottom - netTop);
  const zero = netAt(0);
  const columnWidth = Math.max(2, Math.min(24, slot * 0.6));

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotWidth / 64))));
  const showLabel = (i: number) => (n - 1 - i) % labelEvery === 0;

  const pointerToIndex = (event: React.PointerEvent<SVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const i = n > 1 ? Math.round(((x - left - pad) / (plotWidth - pad * 2)) * (n - 1)) : 0;
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setActive((i) => Math.max(0, Math.min(n - 1, (i ?? n - 1) + (event.key === 'ArrowRight' ? 1 : -1))));
    } else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(n - 1);
    else if (event.key === 'Escape') setActive(null);
  };

  const path = (key: 'revenue' | 'expenses') => buckets.map((b, i) => `${i ? 'L' : 'M'}${xAt(i)},${yAt(b[key])}`).join('');
  const current = active === null ? null : buckets[active];
  const interactive = {
    onPointerMove: pointerToIndex,
    onPointerDown: pointerToIndex,
    onPointerLeave: () => setActive(null)
  };

  return (
    <div
      ref={ref}
      className="viz-plot"
      tabIndex={0}
      role="group"
      aria-label="Revenue, expenses and net profit over time. Use left and right arrow keys to read each period; the table view lists every value."
      onKeyDown={onKeyDown}
      onFocus={() => setActive((i) => i ?? n - 1)}
      onBlur={() => setActive(null)}
    >
      {!hasData && <EmptyChart>No sales or expenses in this range yet.</EmptyChart>}
      {width > 0 && (
        <>
          <svg width={width} height={LINE_HEIGHT} className="block touch-pan-y" {...interactive} aria-hidden>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={left} x2={width - RIGHT} y1={yAt(t)} y2={yAt(t)} className={t === 0 ? 'viz-baseline' : 'viz-gridline'} />
                <text x={left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" className="viz-tick">{tickLabel(currency, t)}</text>
              </g>
            ))}
            {buckets.map((b, i) =>
              showLabel(i) ? (
                <text key={b.start} x={xAt(i)} y={LINE_HEIGHT - 6} textAnchor="middle" className="viz-tick">{b.label}</text>
              ) : null
            )}
            {active !== null && <line x1={xAt(active)} x2={xAt(active)} y1={TOP} y2={plotBottom} className="viz-crosshair" />}
            {SERIES.map((s) => (
              <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {SERIES.map((s) => {
              const i = active ?? n - 1;
              return <circle key={s.key} cx={xAt(i)} cy={yAt(buckets[i][s.key])} r={4} fill={s.color} className="viz-ring" />;
            })}
          </svg>

          <div className="viz-subplot-label">Net profit per {granularity}</div>
          <svg width={width} height={NET_HEIGHT} className="block touch-pan-y" {...interactive} aria-hidden>
            {netTicks.map((t) => (
              <g key={t}>
                <line x1={left} x2={width - RIGHT} y1={netAt(t)} y2={netAt(t)} className={t === 0 ? 'viz-baseline' : 'viz-gridline'} />
                <text x={left - 8} y={netAt(t)} dy="0.32em" textAnchor="end" className="viz-tick">{tickLabel(currency, t)}</text>
              </g>
            ))}
            {buckets.map((b, i) => (
              <path
                key={b.start}
                d={columnPath(xAt(i) - columnWidth / 2, columnWidth, zero, netAt(b.net))}
                fill={b.net >= 0 ? 'var(--viz-pos)' : 'var(--viz-neg)'}
                opacity={active === null || active === i ? 1 : 0.45}
              />
            ))}
          </svg>

          {current && active !== null && (
            <Tooltip x={xAt(active)} align={xAt(active) < width / 2 ? 'left' : 'right'}>
              <div className="viz-tooltip-title">{current.longLabel}</div>
              {SERIES.map((s) => (
                <TooltipRow key={s.key} color={s.color} label={s.label} value={money(currency, current[s.key])} />
              ))}
              <TooltipRow
                color={current.net >= 0 ? 'var(--viz-pos)' : 'var(--viz-neg)'}
                label={current.net >= 0 ? 'Net profit' : 'Net loss'}
                value={money(currency, current.net)}
              />
              <TooltipRow label={current.orders === 1 ? 'order' : 'orders'} value={String(current.orders)} />
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}
