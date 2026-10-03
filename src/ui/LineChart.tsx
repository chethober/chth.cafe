import React, { useId, useMemo, useRef, useState } from 'react';
import { Legend } from './primitives';

export interface LineSeries { key: string; label: string; color: string; dashed?: boolean }
export interface LinePoint { label: string; values: Record<string, number> }

/**
 * Single-axis multi-series line chart with a crosshair tooltip.
 * Thin 2px lines, recessive grid, legend + table view for accessibility.
 */
export function LineChart({ series, points, format, height = 220 }: {
  series: LineSeries[]; points: LinePoint[]; format: (v: number) => string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableId = useId();
  const W = 600;
  const H = height;
  const pad = { top: 12, right: 12, bottom: 28, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const { min, max, ticks } = useMemo(() => {
    const all = points.flatMap(p => series.map(s => p.values[s.key] || 0));
    const lo = Math.min(0, ...all);
    const hiRaw = Math.max(1, ...all);
    const step = niceStep((hiRaw - lo) / 4);
    const hi = Math.ceil(hiRaw / step) * step;
    const low = Math.floor(lo / step) * step;
    const t: number[] = [];
    for (let v = low; v <= hi + step / 2; v += step) t.push(v);
    return { min: low, max: hi, ticks: t };
  }, [points, series]);

  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min || 1)) * innerH;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.left) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const hovered = hover !== null ? points[hover] : null;
  const tooltipLeft = hover !== null ? `${(x(hover) / W) * 100}%` : '0';

  return (
    <div className="ws-chart" ref={wrapRef}>
      <Legend items={series.map(s => ({ label: s.label, color: s.color, line: true }))} />
      <div style={{ position: 'relative', marginTop: 12 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Line chart of ${series.map(s => s.label).join(', ')}. Values are listed in the table below.`}
          aria-describedby={tableId}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ touchAction: 'pan-y' }}
        >
          <g className="grid">
            {ticks.map(t => <line key={t} x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} />)}
          </g>
          <g className="axis">
            {ticks.map(t => <text key={t} x={pad.left - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>)}
            {points.map((p, i) => <text key={p.label + i} x={x(i)} y={H - 8} textAnchor="middle">{p.label}</text>)}
          </g>
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} />}
          {series.map(s => (
            <polyline
              key={s.key}
              className="series"
              stroke={s.color}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              points={points.map((p, i) => `${x(i)},${y(p.values[s.key] || 0)}`).join(' ')}
            />
          ))}
          {hover !== null && series.map(s => (
            <circle key={s.key} className="dot" cx={x(hover)} cy={y(points[hover].values[s.key] || 0)} r={5} fill={s.color} />
          ))}
          <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" />
        </svg>
        {hovered && (
          <div className="ws-tooltip" style={{ left: tooltipLeft }} role="status">
            <strong>{hovered.label}</strong>
            {series.map(s => (
              <div key={s.key} className="ws-tooltip-row">
                <span><span className="ws-swatch-line" style={{ background: s.color }} />{s.label}</span>
                <span>{format(hovered.values[s.key] || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <table id={tableId} className="sr-only">
        <caption>Chart data</caption>
        <thead><tr><th scope="col">Period</th>{series.map(s => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.label}</th>{series.map(s => <td key={s.key}>{format(p.values[s.key] || 0)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}
function compact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(abs < 1 ? 2 : 1).replace(/\.?0+$/, '');
}
