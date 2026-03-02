'use client';

import { Fragment, useState, useMemo } from 'react';
import { Trade, TradingDayInfo } from '@/lib/types';

interface TradeLogProps {
  trades: Trade[];
  tradingDays: TradingDayInfo[];
}

interface DayRow {
  dateKey: string;
  dateDisplay: string;
  maxDist: number;
  cashRef: number;
  trades: Trade[];
  totalPnL: number;
  tranches: string[];
  direction: string;
  exitSummary: string;
}

const PAGE_SIZE = 50;

export default function TradeLog({ trades, tradingDays }: TradeLogProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const dayRows = useMemo((): DayRow[] => {
    const tradesByDate = new Map<string, Trade[]>();
    trades.forEach(t => {
      const arr = tradesByDate.get(t.dateKey) || [];
      arr.push(t);
      tradesByDate.set(t.dateKey, arr);
    });

    return tradingDays.map(d => {
      const dayTrades = tradesByDate.get(d.dateKey) || [];
      const totalPnL = Math.round(dayTrades.reduce((s, t) => s + t.pnl, 0) * 10) / 10;
      const tranches = [...new Set(dayTrades.map(t => t.tranche).filter(Boolean))] as string[];
      const direction = dayTrades.length > 0 ? dayTrades[0].direction : '';
      const reasons = [...new Set(dayTrades.map(t => t.exitReason.replace(/ \(ambig\)/, '')))];
      const exitSummary = reasons.join(' / ');
      return { ...d, trades: dayTrades, totalPnL, tranches, direction, exitSummary };
    });
  }, [trades, tradingDays]);

  const totalPages = Math.ceil(dayRows.length / PAGE_SIZE);
  const slice = dayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggle = (dk: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(dk)) next.delete(dk); else next.add(dk);
      return next;
    });
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Date', 'Entries', 'Dir', 'Cash', 'P&L', 'Max Dist', 'Exit'].map(h => (
                <th key={h} className="text-[9px] text-white/25 uppercase tracking-wider px-2 py-2 text-left font-semibold border-b border-white/[0.06]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map(day => {
              const hasMultiple = day.trades.length > 1;
              const isExpanded = expanded.has(day.dateKey);
              const pnlColor = day.totalPnL > 0 ? 'text-emerald-400' : day.totalPnL < 0 ? 'text-red-400' : 'text-white/30';
              const dirColor = day.direction === 'LONG' ? 'text-emerald-400' : day.direction === 'SHORT' ? 'text-red-400' : 'text-white/20';

              if (day.trades.length === 0) {
                return (
                  <tr key={day.dateKey} className="opacity-40">
                    <td className="text-[11px] px-2 py-1.5 font-mono text-white/50 border-b border-white/[0.02]">{day.dateDisplay}</td>
                    <td className="text-[10px] px-2 py-1.5 text-white/20 italic border-b border-white/[0.02]">No trade</td>
                    <td className="text-[11px] px-2 py-1.5 text-white/20 border-b border-white/[0.02]">—</td>
                    <td className="text-[11px] px-2 py-1.5 font-mono text-white/30 border-b border-white/[0.02]">{day.cashRef}</td>
                    <td className="text-[11px] px-2 py-1.5 text-white/20 border-b border-white/[0.02]">—</td>
                    <td className="text-[11px] px-2 py-1.5 font-mono text-blue-400/30 border-b border-white/[0.02]">{day.maxDist || '—'}</td>
                    <td className="text-[11px] px-2 py-1.5 text-white/20 border-b border-white/[0.02]">—</td>
                  </tr>
                );
              }

              return (
                <Fragment key={day.dateKey}>
                  {/* Summary row */}
                  <tr
                    className={`hover:bg-white/[0.02] transition-colors ${hasMultiple ? 'cursor-pointer' : ''}`}
                    onClick={hasMultiple ? () => toggle(day.dateKey) : undefined}
                  >
                    <td className="text-[11px] px-2 py-1.5 font-mono text-white/50 border-b border-white/[0.02]">
                      {hasMultiple && <span className="text-white/25 mr-1">{isExpanded ? '▼' : '▶'}</span>}
                      {day.dateDisplay}
                    </td>
                    <td className="text-[10px] px-2 py-1.5 border-b border-white/[0.02]">
                      <div className="flex gap-1">
                        {day.tranches.length > 0 ? day.tranches.map(t => (
                          <span key={t} className={`px-1.5 py-0.5 rounded font-semibold ${
                            t === 'E1' ? 'bg-emerald-500/10 text-emerald-400' :
                            t === 'E2' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>{t}</span>
                        )) : <span className="text-emerald-400/60 font-semibold">E1</span>}
                      </div>
                    </td>
                    <td className={`text-[11px] px-2 py-1.5 font-mono font-semibold border-b border-white/[0.02] ${dirColor}`}>{day.direction}</td>
                    <td className="text-[11px] px-2 py-1.5 font-mono text-white/50 border-b border-white/[0.02]">{day.cashRef}</td>
                    <td className={`text-[11px] px-2 py-1.5 font-mono font-bold border-b border-white/[0.02] ${pnlColor}`}>
                      {day.totalPnL > 0 ? '+' : ''}{day.totalPnL}
                    </td>
                    <td className="text-[11px] px-2 py-1.5 font-mono text-blue-400/50 border-b border-white/[0.02]">{day.maxDist}</td>
                    <td className="text-[11px] px-2 py-1.5 border-b border-white/[0.02]">
                      {day.trades.length === 1 ? (
                        <ExitBadge reason={day.trades[0].exitReason} />
                      ) : (
                        <span className="text-[10px] text-white/30">{day.exitSummary}</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded sub-rows */}
                  {isExpanded && day.trades.map((t, i) => {
                    const subPnlColor = t.pnl > 0 ? 'text-emerald-400/80' : t.pnl < 0 ? 'text-red-400/80' : 'text-white/20';
                    const trancheColor = t.tranche === 'E1' ? 'text-emerald-400/60' :
                      t.tranche === 'E2' ? 'text-blue-400/60' : 'text-amber-400/60';
                    return (
                      <tr key={i} className="bg-white/[0.01]">
                        <td className="text-[10px] px-2 py-1 border-b border-white/[0.02]" />
                        <td className={`text-[10px] px-2 py-1 font-mono font-semibold border-b border-white/[0.02] ${trancheColor}`}>
                          {t.tranche || 'E1'}
                        </td>
                        <td colSpan={2} className="text-[10px] px-2 py-1 font-mono text-white/35 border-b border-white/[0.02]">
                          {t.entryPrice} ({t.entryTime.split(' ')[1]}) → {t.exitPrice} ({t.exitTime.split(' ')[1]})
                        </td>
                        <td className={`text-[10px] px-2 py-1 font-mono font-bold border-b border-white/[0.02] ${subPnlColor}`}>
                          {t.pnl > 0 ? '+' : ''}{t.pnl}
                        </td>
                        <td className="text-[10px] px-2 py-1 border-b border-white/[0.02]" />
                        <td className="text-[10px] px-2 py-1 border-b border-white/[0.02]">
                          <ExitBadge reason={t.exitReason} />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-3 items-center">
          <button
            className="px-3 py-1 bg-white/5 border border-white/[0.08] rounded text-white/45 text-xs cursor-pointer disabled:opacity-25 disabled:cursor-default hover:bg-white/[0.08] transition-colors"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prev
          </button>
          <span className="text-[11px] text-white/30 font-mono">{page + 1} / {totalPages}</span>
          <button
            className="px-3 py-1 bg-white/5 border border-white/[0.08] rounded text-white/45 text-xs cursor-pointer disabled:opacity-25 disabled:cursor-default hover:bg-white/[0.08] transition-colors"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ExitBadge({ reason }: { reason: string }) {
  let cls = 'bg-white/5 text-white/40';
  if (reason.startsWith('TP')) cls = 'bg-emerald-500/10 text-emerald-400';
  else if (reason.startsWith('SL')) cls = 'bg-red-500/10 text-red-400';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${cls}`}>{reason}</span>;
}
