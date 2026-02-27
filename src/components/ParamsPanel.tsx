'use client';

import { Session, LUNCH_DEFAULTS, NIGHT_DEFAULTS } from '@/lib/types';

interface ParamsPanelProps {
  session: Session;
  onSessionChange: (s: Session) => void;
  params: {
    entry: number | string;
    tp: number | string;
    sl: number | string;
    entryEnd: string;
    backstop: string;
    ambiguous: string;
    allowReentry: boolean;
  };
  onParamChange: (key: string, value: unknown) => void;
  onRun: () => void;
  canRun: boolean;
}

export default function ParamsPanel({ session, onSessionChange, params, onParamChange, onRun, canRun }: ParamsPanelProps) {
  const switchSession = (s: Session) => {
    onSessionChange(s);
    const def = s === 'lunch' ? LUNCH_DEFAULTS : NIGHT_DEFAULTS;
    onParamChange('entry', def.entry);
    onParamChange('tp', def.tp);
    onParamChange('sl', def.sl);
    onParamChange('entryEnd', def.entryEnd);
    onParamChange('backstop', def.backstop);
  };

  return (
    <div>
      {/* Session Tabs */}
      <div className="flex mb-5">
        <button
          className={`px-6 py-2 text-sm font-semibold border transition-all rounded-l-lg ${
            session === 'lunch'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-transparent text-white/35 border-white/[0.06]'
          }`}
          onClick={() => switchSession('lunch')}
        >
          Lunch Session
        </button>
        <button
          className={`px-6 py-2 text-sm font-semibold border border-l-0 transition-all rounded-r-lg ${
            session === 'night'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-transparent text-white/35 border-white/[0.06]'
          }`}
          onClick={() => switchSession('night')}
        >
          Night Session
        </button>
      </div>

      {/* Params Grid */}
      <div className="grid grid-cols-2 gap-6 mb-5 p-5 bg-white/[0.02] rounded-xl border border-white/5">
        {/* Entry & Exit */}
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">Entry & Exit</div>
          <ParamInput label="Entry Deviation" value={params.entry} unit="pts" onChange={v => onParamChange('entry', v)} />
          <ParamInput label="Take Profit" value={params.tp} unit="pts" onChange={v => onParamChange('tp', v)} />
          <ParamInput label="Stop Loss" value={params.sl} unit="pts" onChange={v => onParamChange('sl', v)} />
        </div>

        {/* Session Controls */}
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">Session Controls</div>
          <ParamTimeInput label="Entry Window End" value={params.entryEnd} unit="UTC+8" onChange={v => onParamChange('entryEnd', v)} />
          <ParamTimeInput label="Time Backstop" value={params.backstop} unit="UTC+8" onChange={v => onParamChange('backstop', v)} />

          <div className="flex items-center gap-2.5 mb-2">
            <label className="text-xs text-white/45 w-[140px] shrink-0">Ambiguous Bars</label>
            <select
              className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-white/80 text-sm font-mono outline-none focus:border-emerald-500/40"
              value={params.ambiguous}
              onChange={e => onParamChange('ambiguous', e.target.value)}
            >
              <option value="conservative">Conservative (SL first)</option>
              <option value="optimistic">Optimistic (TP first)</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 mb-2">
            <label className="text-xs text-white/45 w-[140px] shrink-0">Allow Re-entry</label>
            <button
              className={`relative w-9 h-5 rounded-full transition-colors border-none outline-none cursor-pointer shrink-0 ${
                params.allowReentry ? 'bg-emerald-500/50' : 'bg-white/[0.08]'
              }`}
              onClick={() => onParamChange('allowReentry', !params.allowReentry)}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/80 transition-transform ${
                  params.allowReentry ? 'translate-x-4' : ''
                }`}
              />
            </button>
            <span className="text-[10px] text-white/25">within same session</span>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        className="px-7 py-2 bg-emerald-500 text-[#0f1117] rounded-lg text-sm font-bold cursor-pointer transition-all hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-default mb-5"
        onClick={onRun}
        disabled={!canRun}
      >
        Run Backtest
      </button>
    </div>
  );
}

function ParamInput({ label, value, unit, onChange }: { label: string; value: number | string; unit: string; onChange: (v: number | string) => void }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <label className="text-xs text-white/45 w-[140px] shrink-0">{label}</label>
      <input
        type="number"
        className="w-20 px-2.5 py-1 bg-white/5 border border-white/10 rounded text-white/80 text-sm font-mono outline-none focus:border-emerald-500/40"
        value={value}
        onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
      />
      <span className="text-[10px] text-white/25">{unit}</span>
    </div>
  );
}

function ParamTimeInput({ label, value, unit, onChange }: { label: string; value: string; unit: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <label className="text-xs text-white/45 w-[140px] shrink-0">{label}</label>
      <input
        type="text"
        className="w-20 px-2.5 py-1 bg-white/5 border border-white/10 rounded text-white/80 text-sm font-mono outline-none focus:border-emerald-500/40"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <span className="text-[10px] text-white/25">{unit}</span>
    </div>
  );
}
