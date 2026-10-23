// Small dependency-free chart kit (SVG + flex). Every chart ships a title, the
// question it answers, a hover tooltip, a "valeurs" table toggle and explicit
// empty/loading/error states. ponytail: hand-rolled on purpose — add a chart
// library only if we need zoom/brush or many more chart types.
import React, { useEffect, useRef, useState } from 'react';
import { Table2, AlertTriangle, Loader2 } from 'lucide-react';
import type { RiskBucket, Health } from '../../lib/insights';

// Semantic colors — one meaning, one color, everywhere in the Command Center.
export const RISK_COLORS: Record<RiskBucket, string> = {
  bloquee: '#F43F5E',   // = StatusBadge "Bloqué"
  critique: '#BE123C',
  en_retard: '#F97316',
  proche: '#F59E0B',
  a_jour: '#10B981',
  sans_date: '#64748B',
};
export const HEALTH_STYLES: Record<Health, { color: string; chip: string }> = {
  sain: { color: '#10B981', chip: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50' },
  surveiller: { color: '#F59E0B', chip: 'bg-amber-950/40 text-amber-300 border-amber-800/50' },
  critique: { color: '#F43F5E', chip: 'bg-rose-950/40 text-rose-300 border-rose-800/50' },
  termine: { color: '#3B82F6', chip: 'bg-[#2563EB]/15 text-[#93C5FD] border-[#2563EB]/40' },
  arrete: { color: '#64748B', chip: 'bg-slate-900 text-slate-400 border-slate-700' },
};
// Categorical series (validated for CVD on the #0F172A surface).
export const SERIES = ['#3B82F6', '#D97706', '#8B5CF6', '#0D9488'];
export const REFERENCE = '#64748B'; // previous period / reference lines

export const fmtHours = (min: number) => (min >= 60 ? `${Math.round((min / 60) * 10) / 10} h` : `${min} min`);
export const fmtDay = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

interface CardProps {
  title: string;
  question: string;
  source?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  table?: { head: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const ChartCard: React.FC<CardProps> = ({ title, question, source, loading, error, empty, emptyText, table, children, className = '', actions }) => {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 min-w-0 ${className}`} aria-label={title}>
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-100">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{question}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {actions}
          {table && !empty && !loading && !error && (
            <button
              onClick={() => setShowTable(v => !v)}
              className={`p-1.5 rounded border text-[10px] flex items-center gap-1 ${showTable ? 'border-[#2563EB]/50 text-[#93C5FD] bg-[#2563EB]/10' : 'border-[#1E293B] text-slate-400 hover:text-slate-200'}`}
              aria-pressed={showTable}
              title="Afficher les valeurs exactes"
            >
              <Table2 className="w-3 h-3" /> Valeurs
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <div className="h-32 flex items-center justify-center text-xs text-slate-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : error ? (
        <div className="h-32 flex items-center justify-center text-xs text-rose-300 gap-2 text-center px-4"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>
      ) : empty ? (
        <div className="h-32 flex items-center justify-center text-xs text-slate-500 text-center px-4">{emptyText || 'Aucune donnée sur cette période.'}</div>
      ) : showTable && table ? (
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-[11px]">
            <thead><tr>{table.head.map(h => <th key={h} className="text-left font-semibold text-slate-400 py-1 pr-3 border-b border-[#1E293B]">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="py-1 pr-3 text-slate-200 border-b border-[#1E293B]/60 tabular-nums">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
      {source && <p className="text-[10px] text-slate-500 mt-3">{source}</p>}
    </section>
  );
};

export const Legend: React.FC<{ items: { label: string; color: string; dashed?: boolean }[] }> = ({ items }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
    {items.map(i => (
      <span key={i.label} className="inline-flex items-center gap-1.5 text-[10px] text-slate-300">
        <span className="w-3 h-0.5 rounded" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 3px, transparent 3px 5px)` : i.color, height: 2 }} />
        {i.label}
      </span>
    ))}
  </div>
);

export interface LineSeries { name: string; color: string; dashed?: boolean; values: number[] }

/** Multi-series line chart on one shared y-axis; crosshair tooltip on hover/touch. */
export const LineChart: React.FC<{ labels: string[]; series: LineSeries[]; unit?: string; height?: number }> = ({ labels, series, unit = '', height = 160 }) => {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so axis text keeps its size on wide cards.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = height, L = 28, R = 8, T = 8, B = 20;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const n = labels.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, Math.round(max / 2), max];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };
  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img"
        aria-label={series.map(s => `${s.name} : total ${s.values.reduce((a, b) => a + b, 0)}${unit}`).join(', ')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#1E293B" strokeWidth={1} />
            <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#64748B">{t}</text>
          </g>
        ))}
        {[0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => n > 0 && a.indexOf(v) === i).map(i => (
          <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={9} fill="#64748B">{labels[i]}</text>
        ))}
        {series.map(s => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.dashed ? '4 3' : undefined} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#475569" strokeWidth={1} />
            {series.map(s => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="#0F172A" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="absolute top-0 pointer-events-none bg-[#0B1120] border border-[#334155] rounded px-2 py-1.5 text-[10px] shadow-lg z-10"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})` }}>
          <p className="font-bold text-slate-200 mb-0.5">{labels[hover]}</p>
          {series.map(s => (
            <p key={s.name} className="text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.name} : <b className="text-slate-100">{s.values[hover] ?? 0}{unit}</b>
            </p>
          ))}
        </div>
      )}
      {series.length > 1 && <Legend items={series.map(s => ({ label: s.name, color: s.color, dashed: s.dashed }))} />}
    </div>
  );
};

export interface BarSegment { name: string; value: number; color: string }
export interface BarRow { id: string; label: string; segments: BarSegment[]; note?: string; onClick?: () => void }

/** Horizontal stacked bars (one shared scale), 2px gaps between segments. */
export const StackedBars: React.FC<{ rows: BarRow[]; unit?: (v: number) => string; legend?: { label: string; color: string }[] }> = ({ rows, unit = v => String(v), legend }) => {
  const max = Math.max(1, ...rows.map(r => r.segments.reduce((s, x) => s + x.value, 0)));
  return (
    <div className="space-y-2">
      {rows.map(r => {
        const total = r.segments.reduce((s, x) => s + x.value, 0);
        const Row = r.onClick ? 'button' : 'div';
        return (
          <Row key={r.id} onClick={r.onClick} className={`w-full text-left grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 ${r.onClick ? 'hover:bg-[#1E293B]/50 rounded px-1 -mx-1' : ''}`}>
            <span className="text-[11px] text-slate-300 truncate" title={r.label}>{r.label}</span>
            <span className="flex h-3 gap-[2px] min-w-0">
              {r.segments.filter(s => s.value > 0).map(s => (
                <span key={s.name} title={`${s.name} : ${unit(s.value)}`} className="h-full first:rounded-l last:rounded-r"
                  style={{ width: `${(s.value / max) * 100}%`, background: s.color, minWidth: 3 }} />
              ))}
            </span>
            <span className="text-[11px] text-slate-200 tabular-nums text-right whitespace-nowrap">{unit(total)}{r.note ? <span className="text-slate-500"> · {r.note}</span> : null}</span>
          </Row>
        );
      })}
      {legend && <Legend items={legend} />}
    </div>
  );
};

/** Simple vertical bars for a single series (e.g. AXP per week). */
export const ColumnChart: React.FC<{ data: { label: string; value: number }[]; color?: string; unit?: string }> = ({ data, color = SERIES[0], unit = '' }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end" title={`${d.label} : ${d.value}${unit}`}>
          <span className="text-[9px] text-slate-400 tabular-nums">{d.value || ''}</span>
          <div className="w-full rounded-t" style={{ height: `${(d.value / max) * 80}%`, minHeight: d.value ? 3 : 1, background: d.value ? color : '#1E293B' }} />
          <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export const ProgressBar: React.FC<{ value: number; color?: string; label?: string }> = ({ value, color = SERIES[0], label }) => (
  <div className="h-1.5 rounded-full bg-[#1E293B] overflow-hidden" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
  </div>
);
