'use client';

import { BacktestStats } from '@/lib/types';

interface StatsGridProps {
  stats: BacktestStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const pnlColor = parseFloat(stats.totalPnL) >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pfColor = parseFloat(stats.profitFactor) >= 1.5 ? 'text-emerald-400' : parseFloat(stats.profitFactor) >= 1 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2 mb-5">
      <StatCard label="Total P&L" value={stats.totalPnL} color={pnlColor} sub={`${stats.totalTrades} trades / ${stats.totalDays} days`} />
      <StatCard label="Win Rate" value={`${stats.winRate}%`} color="text-white/80" sub={`${stats.wins}W ${stats.losses}L${stats.flat ? ' ' + stats.flat + 'F' : ''}`} />
      <StatCard label="Profit Factor" value={stats.profitFactor} color={pfColor} />
      <StatCard label="Max Drawdown" value={stats.maxDD} color="text-red-400" />
      <StatCard label="Avg Win" value={stats.avgWin} color="text-emerald-400" />
      <StatCard label="Avg Loss" value={stats.avgLoss} color="text-red-400" />
      <StatCard label="Max Consec Losses" value={String(stats.maxCL)} color={stats.maxCL >= 5 ? 'text-red-400' : 'text-white/80'} />
      <StatCard label="No-Trade Days" value={String(stats.noTradeDays)} color="text-white/80" sub={`of ${stats.totalDays} days`} />
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-white/[0.025] border border-white/5 rounded-lg p-3">
      <div className="text-[10px] text-white/35 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-white/25 mt-1">{sub}</div>}
    </div>
  );
}
