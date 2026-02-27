'use client';

import { BacktestStats } from '@/lib/types';

interface StatsGridProps {
  stats: BacktestStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const pnlColor = parseFloat(stats.totalPnL) >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pfColor = parseFloat(stats.profitFactor) >= 1.5 ? 'text-emerald-400' : parseFloat(stats.profitFactor) >= 1 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-2 mb-6">
      {/* Row 1: Core performance */}
      <div className="grid grid-cols-6 gap-2">
        <StatCard label="Net P&L" value={stats.totalPnL} color={pnlColor} sub={`${stats.totalTrades} trades`} highlight />
        <StatCard label="Gross Profit" value={stats.grossProfit} color="text-emerald-400" />
        <StatCard label="Gross Loss" value={stats.grossLoss} color="text-red-400" />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} color="text-white/80" sub={`${stats.wins}W / ${stats.losses}L`} />
        <StatCard label="Profit Factor" value={stats.profitFactor} color={pfColor} />
        <StatCard label="Max Drawdown" value={stats.maxDD} color="text-red-400" />
      </div>
      {/* Row 2: Detail stats + max distance */}
      <div className="grid grid-cols-6 gap-2">
        <StatCard label="Avg Win" value={stats.avgWin} color="text-emerald-400/80" />
        <StatCard label="Avg Loss" value={stats.avgLoss} color="text-red-400/80" />
        <StatCard label="Max Consec L" value={String(stats.maxCL)} color={stats.maxCL >= 5 ? 'text-red-400' : 'text-white/60'} />
        <StatCard label="No-Trade Days" value={String(stats.noTradeDays)} color="text-white/60" sub={`of ${stats.totalDays}`} />
        <StatCard label="Dist Median" value={stats.maxDistMedian} color="text-blue-400/80" sub="max dist from cash" />
        <StatCard label="Dist P30 / P10" value={`${stats.maxDistP30} / ${stats.maxDistP10}`} color="text-blue-400/60" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub, highlight }: { label: string; value: string; color: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border transition-all ${
      highlight
        ? 'bg-white/[0.04] border-white/[0.08]'
        : 'bg-white/[0.02] border-white/[0.04]'
    }`}>
      <div className="text-[9px] text-white/30 uppercase tracking-wider font-semibold mb-1.5">{label}</div>
      <div className={`text-lg font-bold font-mono leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-white/20 mt-1.5">{sub}</div>}
    </div>
  );
}
