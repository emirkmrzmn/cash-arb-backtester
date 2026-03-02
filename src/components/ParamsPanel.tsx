'use client';

import { Session, LUNCH_DEFAULTS, NIGHT_DEFAULTS } from '@/lib/types';

interface ParamsPanelProps {
  session: Session;
  onSessionChange: (s: Session) => void;
  params: {
    entry: number | string;
    tp: number | string;
    sl: number | string;
    noSL: boolean;
    entryEnd: string;
    backstop: string;
    ambiguous: string;
    allowReentry: boolean;
    enableE2: boolean;
    enableE3: boolean;
    entryDev2: number | string;
    entryDev3: number | string;
    tp2: number | string;
    tp3: number | string;
    sl2: number | string;
    sl3: number | string;
    oneSideOnly: boolean;
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
    onParamChange('entryDev2', def.entryDev2);
    onParamChange('entryDev3', def.entryDev3);
    onParamChange('tp2', def.tp2);
    onParamChange('tp3', def.tp3);
    onParamChange('sl2', def.sl2);
    onParamChange('sl3', def.sl3);
  };

  return (
    <form onSubmit={e => { e.preventDefault(); if (canRun) onRun(); }}>
      {/* Session Tabs */}
      <div className="flex mb-5">
        <button
          className={`px-6 py-2.5 text-sm font-semibold border transition-all rounded-l-lg ${
            session === 'lunch'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-transparent text-white/35 border-white/[0.06] hover:text-white/50'
          }`}
          onClick={() => switchSession('lunch')}
        >
          Lunch Session
        </button>
        <button
          className={`px-6 py-2.5 text-sm font-semibold border border-l-0 transition-all rounded-r-lg ${
            session === 'night'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-transparent text-white/35 border-white/[0.06] hover:text-white/50'
          }`}
          onClick={() => switchSession('night')}
        >
          Night Session
        </button>
      </div>

      {/* Params Grid */}
      <div className="grid grid-cols-2 gap-6 mb-5 p-5 bg-white/[0.02] rounded-xl border border-white/5">
        {/* Left: Entry & Exit */}
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">E1 Entry & Exit</div>
          <ParamInput label="Entry Deviation" value={params.entry} unit="pts" onChange={v => onParamChange('entry', v)} />
          <ParamInput label="Take Profit" value={params.tp} unit="pts" onChange={v => onParamChange('tp', v)} />
          <ParamInput label="Stop Loss" value={params.sl} unit="pts" onChange={v => onParamChange('sl', v)} disabled={params.noSL} />
          <Toggle label="No SL, purely time based" enabled={params.noSL} onToggle={() => onParamChange('noSL', !params.noSL)} />

          {/* E2 Section */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2.5 mb-2">
              <Toggle label="E2 (optional)" enabled={params.enableE2} onToggle={() => onParamChange('enableE2', !params.enableE2)} />
            </div>
            {params.enableE2 && (
              <div className="ml-1 pl-3 border-l border-emerald-500/20">
                <ParamInput label="Entry Dev E2" value={params.entryDev2} unit="pts" onChange={v => onParamChange('entryDev2', v)} />
                <ParamInput label="Take Profit E2" value={params.tp2} unit="pts" onChange={v => onParamChange('tp2', v)} />
                <ParamInput label="Stop Loss E2" value={params.sl2} unit="pts" onChange={v => onParamChange('sl2', v)} disabled={params.noSL} />
              </div>
            )}
          </div>

          {/* E3 Section */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2.5 mb-2">
              <Toggle label="E3 (optional)" enabled={params.enableE3} onToggle={() => onParamChange('enableE3', !params.enableE3)} disabled={!params.enableE2} />
            </div>
            {params.enableE3 && params.enableE2 && (
              <div className="ml-1 pl-3 border-l border-amber-500/20">
                <ParamInput label="Entry Dev E3" value={params.entryDev3} unit="pts" onChange={v => onParamChange('entryDev3', v)} />
                <ParamInput label="Take Profit E3" value={params.tp3} unit="pts" onChange={v => onParamChange('tp3', v)} />
                <ParamInput label="Stop Loss E3" value={params.sl3} unit="pts" onChange={v => onParamChange('sl3', v)} disabled={params.noSL} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Session Controls */}
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">Session Controls</div>
          <ParamTimeInput label="Entry Window End" value={params.entryEnd} unit="UTC+8" onChange={v => onParamChange('entryEnd', v)} />
          <ParamTimeInput label="Time Backstop" value={params.backstop} unit="UTC+8" onChange={v => onParamChange('backstop', v)} />

          <div className="flex items-center gap-2.5 mb-2">
            <label className="text-xs text-white/45 w-[140px] shrink-0">Ambiguous Bars</label>
            <select
              className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/80 text-sm font-mono outline-none focus:border-emerald-500/40"
              value={params.ambiguous}
              onChange={e => onParamChange('ambiguous', e.target.value)}
            >
              <option value="conservative">Conservative (SL first)</option>
              <option value="optimistic">Optimistic (TP first)</option>
            </select>
          </div>

          <Toggle label="Allow Re-entry" enabled={params.allowReentry} onToggle={() => onParamChange('allowReentry', !params.allowReentry)} sub="within same session" />
          <Toggle label="One side only" enabled={params.oneSideOnly} onToggle={() => onParamChange('oneSideOnly', !params.oneSideOnly)} sub="no direction flip" />

          {/* Entry criteria summary */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Entry / Exit Criteria</div>
            <div className="text-[11px] text-white/40 font-mono space-y-1">
              <div><span className="text-emerald-400/70">E1</span> entry: cash ± {String(params.entry)} → TP +{String(params.tp)} / {params.noSL ? <span className="text-amber-400/70">no SL</span> : <>SL −{String(params.sl)}</>}</div>
              {params.enableE2 && <div><span className="text-blue-400/70">E2</span> entry: cash ± {String(params.entryDev2)} → TP +{String(params.tp2)} / {params.noSL ? <span className="text-amber-400/70">no SL</span> : <>SL −{String(params.sl2)}</>}</div>}
              {params.enableE3 && params.enableE2 && <div><span className="text-amber-400/70">E3</span> entry: cash ± {String(params.entryDev3)} → TP +{String(params.tp3)} / {params.noSL ? <span className="text-amber-400/70">no SL</span> : <>SL −{String(params.sl3)}</>}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        type="submit"
        className="px-7 py-2.5 bg-emerald-500 text-[#0f1117] rounded-lg text-sm font-bold cursor-pointer transition-all hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-default mb-5"
        disabled={!canRun}
      >
        Run Backtest
      </button>
    </form>
  );
}

function ParamInput({ label, value, unit, onChange, disabled }: { label: string; value: number | string; unit: string; onChange: (v: number | string) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 mb-2 ${disabled ? 'opacity-40' : ''}`}>
      <label className="text-xs text-white/45 w-[140px] shrink-0">{label}</label>
      <input
        type="number"
        className="w-20 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/80 text-sm font-mono outline-none focus:border-emerald-500/40 transition-colors disabled:cursor-not-allowed"
        value={value}
        onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        disabled={disabled}
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
        className="w-20 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/80 text-sm font-mono outline-none focus:border-emerald-500/40 transition-colors"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <span className="text-[10px] text-white/25">{unit}</span>
    </div>
  );
}

function Toggle({ label, enabled, onToggle, sub, disabled }: { label: string; enabled: boolean; onToggle: () => void; sub?: string; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 mb-2 ${disabled ? 'opacity-40' : ''}`}>
      <label className="text-xs text-white/45 w-[140px] shrink-0">{label}</label>
      <button
        className={`relative w-9 h-5 rounded-full transition-colors border-none outline-none cursor-pointer shrink-0 ${
          enabled ? 'bg-emerald-500/50' : 'bg-white/[0.08]'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
        onClick={disabled ? undefined : onToggle}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/80 transition-transform ${enabled ? 'translate-x-4' : ''}`} />
      </button>
      {sub && <span className="text-[10px] text-white/25">{sub}</span>}
    </div>
  );
}
