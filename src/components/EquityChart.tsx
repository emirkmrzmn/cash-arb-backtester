'use client';

import { EquityPoint } from '@/lib/types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, ComposedChart } from 'recharts';

interface EquityChartProps {
  data: EquityPoint[];
}

export default function EquityChart({ data }: EquityChartProps) {
  if (!data.length) return null;

  return (
    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="idx"
            tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
            label={{ value: 'Trade #', fill: 'rgba(255,255,255,0.25)', fontSize: 10, position: 'insideBottom', offset: -2 }}
            stroke="rgba(255,255,255,0.06)"
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }}
            label={{ value: 'Cumulative P&L (pts)', fill: 'rgba(255,255,255,0.25)', fontSize: 10, angle: -90, position: 'insideLeft', offset: 5 }}
            stroke="rgba(255,255,255,0.06)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1d23',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'monospace',
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
            itemStyle={{ color: '#e0e0e0' }}
            formatter={(value: unknown) => [`Cum P&L: ${Number(value).toFixed(1)}`, '']}
            labelFormatter={(label: unknown) => {
              const pt = data.find(d => d.idx === Number(label));
              return `Trade #${label} — ${pt?.date || ''}`;
            }}
          />
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bd94" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#38bd94" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="pnl" stroke="none" fill="url(#pnlGradient)" />
          <Line type="monotone" dataKey="pnl" stroke="#38bd94" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bd94' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
