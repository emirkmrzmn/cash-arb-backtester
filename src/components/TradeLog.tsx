'use client';

import { useState } from 'react';
import { Trade } from '@/lib/types';

interface TradeLogProps {
  trades: Trade[];
}

const PAGE_SIZE = 50;

export default function TradeLog({ trades }: TradeLogProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(trades.length / PAGE_SIZE);
  const slice = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['#', 'Date', 'Dir', 'Cash Ref', 'Entry', 'Entry Time', 'Exit', 'Exit Time', 'P&L', 'Exit Reason'].map(h => (
                <th key={h} className="text-[10px] text-white/30 uppercase tracking-wide px-2 py-1.5 text-left font-semibold border-b border-white/[0.06]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((t, i) => {
              const n = page * PAGE_SIZE + i + 1;
              const dirColor = t.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400';
              const pnlColor = t.pnl > 0 ? 'text-emerald-400' : t.pnl < 0 ? 'text-red-400' : 'text-white/40';
              let reasonClass = 'bg-white/5 text-white/45';
              if (t.exitReason.startsWith('TP')) reasonClass = 'bg-emerald-500/10 text-emerald-400';
              else if (t.exitReason.startsWith('SL')) reasonClass = 'bg-red-500/10 text-red-400';

              return (
                <tr key={n} className="even:bg-white/[0.01]">
                  <td className="text-xs px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{n}</td>
                  <td className="text-xs px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{t.date}</td>
                  <td className={`text-xs px-2 py-1 font-mono font-semibold border-b border-white/[0.025] ${dirColor}`}>{t.direction}</td>
                  <td className="text-xs px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{t.cashRef}</td>
                  <td className="text-xs px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{t.entryPrice}</td>
                  <td className="text-[11px] px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{t.entryTime}</td>
                  <td className="text-xs px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{t.exitPrice}</td>
                  <td className="text-[11px] px-2 py-1 font-mono text-white/60 border-b border-white/[0.025]">{t.exitTime}</td>
                  <td className={`text-xs px-2 py-1 font-mono font-semibold border-b border-white/[0.025] ${pnlColor}`}>
                    {t.pnl > 0 ? '+' : ''}{t.pnl}
                  </td>
                  <td className="text-xs px-2 py-1 border-b border-white/[0.025]">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${reasonClass}`}>{t.exitReason}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-2.5 items-center">
          <button
            className="px-3 py-1 bg-white/5 border border-white/[0.08] rounded text-white/45 text-xs cursor-pointer disabled:opacity-25 disabled:cursor-default"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prev
          </button>
          <span className="text-[11px] text-white/30">{page + 1} / {totalPages}</span>
          <button
            className="px-3 py-1 bg-white/5 border border-white/[0.08] rounded text-white/45 text-xs cursor-pointer disabled:opacity-25 disabled:cursor-default"
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
