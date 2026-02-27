'use client';

import { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import ParamsPanel from '@/components/ParamsPanel';
import StatsGrid from '@/components/StatsGrid';
import EquityChart from '@/components/EquityChart';
import TradeLog from '@/components/TradeLog';
import DebugLog from '@/components/DebugLog';
import { readXlsx, parseOhlc, parseCash, ParsedData, ParsedCash } from '@/lib/dataParser';
import { runBacktestEngine } from '@/lib/backtestEngine';
import { parseTimeStr, fmtDate, fmtDateTime } from '@/lib/dateUtils';
import { Session, BacktestResult, LUNCH_DEFAULTS, NIGHT_DEFAULTS } from '@/lib/types';

type ViewTab = 'chart' | 'log' | 'debug';

export default function Home() {
  const [ohlcData, setOhlcData] = useState<ParsedData | null>(null);
  const [cashData, setCashData] = useState<ParsedCash | null>(null);
  const [ohlcFileName, setOhlcFileName] = useState('');
  const [cashFileName, setCashFileName] = useState('');

  const [session, setSession] = useState<Session>('lunch');
  const [params, setParams] = useState({
    entry: LUNCH_DEFAULTS.entry,
    tp: LUNCH_DEFAULTS.tp,
    sl: LUNCH_DEFAULTS.sl,
    entryEnd: LUNCH_DEFAULTS.entryEnd,
    backstop: LUNCH_DEFAULTS.backstop,
    ambiguous: 'conservative',
    allowReentry: false,
  });

  const [results, setResults] = useState<BacktestResult | null>(null);
  const [activeView, setActiveView] = useState<ViewTab>('chart');

  const handleOhlcFile = useCallback(async (file: File) => {
    const raw = await readXlsx(file);
    const parsed = parseOhlc(raw);
    setOhlcData(parsed);
    setOhlcFileName(file.name);
    setResults(null);
  }, []);

  const handleCashFile = useCallback(async (file: File) => {
    const raw = await readXlsx(file);
    const parsed = parseCash(raw);
    setCashData(parsed);
    setCashFileName(file.name);
    setResults(null);
  }, []);

  const handleParamChange = useCallback((key: string, value: unknown) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleRun = useCallback(() => {
    if (!ohlcData || !cashData) return;
    const backParams = {
      entryDev: Number(params.entry) || 0,
      tp: Number(params.tp) || 0,
      sl: Number(params.sl) || 0,
      entryEndMin: parseTimeStr(params.entryEnd) || (session === 'lunch' ? 685 : 295),
      backstopMin: parseTimeStr(params.backstop) || (session === 'lunch' ? 705 : 300),
      ambiguous: params.ambiguous as 'conservative' | 'optimistic',
      allowReentry: params.allowReentry,
    };
    const r = runBacktestEngine(session, backParams, cashData.cashParsed, ohlcData.barsByTradingDay, ohlcData.sortedTradingDays);
    setResults(r);
    setActiveView('chart');
  }, [ohlcData, cashData, params, session]);

  const canRun = !!(ohlcData?.ohlcParsed.length && cashData?.cashParsed.length);

  // Badge info
  const ohlcInfo = ohlcData?.ohlcParsed.length
    ? `${ohlcData.ohlcParsed.length.toLocaleString()} bars`
    : '';
  const tdInfo = ohlcData?.sortedTradingDays.length
    ? `${ohlcData.sortedTradingDays.length} trading days`
    : '';
  const ohlcRange = ohlcData?.ohlcParsed.length
    ? `${fmtDateTime(ohlcData.ohlcParsed[0].timestamp)} → ${fmtDateTime(ohlcData.ohlcParsed[ohlcData.ohlcParsed.length - 1].timestamp)} (UTC+8)`
    : '';
  const cashInfo = cashData?.cashParsed.length
    ? `${cashData.cashParsed.length} days`
    : '';
  const cashRange = cashData?.cashParsed.length
    ? `${fmtDate(cashData.cashParsed[0].date)} → ${fmtDate(cashData.cashParsed[cashData.cashParsed.length - 1].date)}`
    : '';

  return (
    <div>
      {/* Header */}
      <div className="px-8 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-emerald-400">1×7</span> Cash Arb Backtester
          </h1>
          <div className="text-xs text-white/30 mt-0.5">Topix / Nikkei 225 spread — mean reversion simulator</div>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {ohlcInfo && <Badge text={`OHLC: ${ohlcInfo}`} />}
          {tdInfo && <Badge text={tdInfo} />}
          {ohlcRange && <Badge text={ohlcRange} />}
          {cashInfo && <Badge text={`Cash: ${cashInfo}`} />}
          {cashRange && <Badge text={cashRange} />}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1100px] mx-auto px-8 py-6">
        {/* File uploads */}
        <div className="grid grid-cols-2 gap-3.5 mb-6">
          <FileUpload
            label="OHLC Spread Data"
            hint="XLSX — Timestamp (UTC), Open, High, Low, Close"
            loaded={!!ohlcData}
            loadedText={ohlcData ? `${ohlcFileName} — ${ohlcData.ohlcParsed.length.toLocaleString()} bars → ${ohlcData.sortedTradingDays.length} trading days` : undefined}
            onFile={handleOhlcFile}
          />
          <FileUpload
            label="Cash Reference Prices"
            hint="XLSX — Date (mm/dd/yyyy), Lunch close, Night close"
            loaded={!!cashData}
            loadedText={cashData ? `${cashFileName} — ${cashData.cashParsed.length} days` : undefined}
            onFile={handleCashFile}
          />
        </div>

        {/* Params */}
        <ParamsPanel
          session={session}
          onSessionChange={s => { setSession(s); setResults(null); }}
          params={params}
          onParamChange={handleParamChange}
          onRun={handleRun}
          canRun={canRun}
        />

        {/* Results */}
        {!results ? (
          <div className="text-center py-12 text-white/20 text-sm">
            Upload both data files to run backtest
          </div>
        ) : (
          <div>
            <StatsGrid stats={results.stats} />

            {/* View Tabs */}
            <div className="flex gap-0 mb-3.5 border-b border-white/[0.06]">
              <ViewTabButton label="Equity Curve" active={activeView === 'chart'} onClick={() => setActiveView('chart')} />
              <ViewTabButton label={`Trade Log (${results.trades.length})`} active={activeView === 'log'} onClick={() => setActiveView('log')} />
              <ViewTabButton label="Debug Log" active={activeView === 'debug'} onClick={() => setActiveView('debug')} />
            </div>

            {activeView === 'chart' && <EquityChart data={results.equity} />}
            {activeView === 'log' && <TradeLog trades={results.trades} />}
            {activeView === 'debug' && <DebugLog log={results.debugLog} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <div className="text-[11px] text-white/35 px-2.5 py-1 bg-white/[0.03] rounded font-mono">
      {text}
    </div>
  );
}

function ViewTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`px-4 py-1.5 bg-transparent border-none border-b-2 text-xs font-semibold cursor-pointer tracking-wide uppercase transition-all ${
        active ? 'border-b-emerald-400 text-white/80' : 'border-b-transparent text-white/30'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
