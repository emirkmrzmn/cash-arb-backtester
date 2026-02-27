'use client';

import { EquityPoint, DailyPnLPoint } from '@/lib/types';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, Bar, BarChart, Cell } from 'recharts';

interface EquityChartProps {
  equity: EquityPoint[];
  dailyPnL: DailyPnLPoint[];
}

export default function EquityChart({ equity, dailyPnL }: EquityChartProps) {
  return (
    <div className="space-y-4">
      {/* Equity curve */}
      {equity.length > 0 && (
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">Equity Curve</div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={equity} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="idx"
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                stroke="rgba(255,255,255,0.06)"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }}
                stroke="rgba(255,255,255,0.06)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d23',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                itemStyle={{ color: '#e0e0e0' }}
                formatter={(value: unknown) => [`Cum P&L: ${Number(value).toFixed(1)}`, '']}
                labelFormatter={(label: unknown) => {
                  const pt = equity.find(d => d.idx === Number(label));
                  return `Trade #${label} — ${pt?.date || ''}`;
                }}
              />
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bd94" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#38bd94" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="pnl" stroke="none" fill="url(#pnlGradient)" />
              <Line type="monotone" dataKey="pnl" stroke="#38bd94" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bd94' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily P&L bar chart */}
      {dailyPnL.length > 0 && (
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">Daily P&L</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyPnL} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 9 }}
                stroke="rgba(255,255,255,0.06)"
                interval={Math.max(0, Math.floor(dailyPnL.length / 15))}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }}
                stroke="rgba(255,255,255,0.06)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d23',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                formatter={(value: unknown) => [`P&L: ${Number(value).toFixed(1)}`, '']}
              />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {dailyPnL.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#38bd94' : '#e05f5f'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
