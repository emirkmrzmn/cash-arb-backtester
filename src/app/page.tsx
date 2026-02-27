'use client';

import { useState, useCallback, useMemo } from 'react';
import FileUpload from '@/components/FileUpload';
import ParamsPanel from '@/components/ParamsPanel';
import StatsGrid from '@/components/StatsGrid';
import EquityChart from '@/components/EquityChart';
import TradeLog from '@/components/TradeLog';
import DebugLog from '@/components/DebugLog';
import DateRangePicker from '@/components/DateRangePicker';
import { readXlsx, parseOhlc, parseCash, ParsedData, ParsedCash } from '@/lib/dataParser';
import { runBacktestEngine } from '@/lib/backtestEngine';
import { parseTimeStr, fmtDate, fmtDateTime, dateKey } from '@/lib/dateUtils';
import { Session, BacktestResult, LUNCH_DEFAULTS, NIGHT_DEFAULTS, CashRef } from '@/lib/types';

type ViewTab = 'chart' | 'log' | 'debug';

export default function Home() {
  const [ohlcData, setOhlcData] = useState<ParsedData | null>(null);
  const [cashData, setCashData] = useState<ParsedCash | null>(null);
  const [ohlcFileName, setOhlcFileName] = useState('');
  const [cashFileName, setCashFileName] = useState('');

  // Date range filter
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [session, setSession] = useState<Session>('lunch');
  const [params, setParams] = useState({
    entry: LUNCH_DEFAULTS.entry as number | string,
    tp: LUNCH_DEFAULTS.tp as number | string,
    sl: LUNCH_DEFAULTS.sl as number | string,
    entryEnd: LUNCH_DEFAULTS.entryEnd,
    backstop: LUNCH_DEFAULTS.backstop,
    ambiguous: 'conservative',
    allowReentry: false,
    enableE2: false,
    enableE3: false,
    entryDev2: LUNCH_DEFAULTS.entryDev2 as number | string,
    entryDev3: LUNCH_DEFAULTS.entryDev3 as number | string,
    tp2: LUNCH_DEFAULTS.tp2 as number | string,
    tp3: LUNCH_DEFAULTS.tp3 as number | string,
  });

  const [results, setResults] = useState<BacktestResult | null>(null);
  const [activeView, setActiveView] = useState<ViewTab>('chart');

  // Compute date bounds from cash data
  const dateBounds = useMemo(() => {
    if (!cashData?.cashParsed.length) return null;
    const dates = cashData.cashParsed.map(c => dateKey(c.date)).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [cashData]);

  // Initialize date range when cash data loads
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
    // Set date range to full
    if (parsed.cashParsed.length) {
      const dates = parsed.cashParsed.map(c => dateKey(c.date)).sort();
      setDateStart(dates[0]);
      setDateEnd(dates[dates.length - 1]);
    }
  }, []);

  const handleParamChange = useCallback((key: string, value: unknown) => {
    setParams(prev => {
      const next = { ...prev, [key]: value };
      // If disabling E2, also disable E3
      if (key === 'enableE2' && !value) {
        next.enableE3 = false;
      }
      return next;
    });
  }, []);

  // Filter cash data by date range
  const filteredCash = useMemo((): CashRef[] => {
    if (!cashData?.cashParsed.length) return [];
    if (!dateStart || !dateEnd) return cashData.cashParsed;
    return cashData.cashParsed.filter(c => {
      const k = dateKey(c.date);
      return k >= dateStart && k <= dateEnd;
    });
  }, [cashData, dateStart, dateEnd]);

  const handleRun = useCallback(() => {
    if (!ohlcData || !filteredCash.length) return;
    const backParams = {
      entryDev: Number(params.entry) || 0,
      tp: Number(params.tp) || 0,
      sl: Number(params.sl) || 0,
      entryEndMin: parseTimeStr(params.entryEnd) || (session === 'lunch' ? 685 : 295),
      backstopMin: parseTimeStr(params.backstop) || (session === 'lunch' ? 705 : 300),
      ambiguous: params.ambiguous as 'conservative' | 'optimistic',
      allowReentry: params.allowReentry,
      enableE2: params.enableE2,
      enableE3: params.enableE3,
      entryDev2: Number(params.entryDev2) || 0,
      entryDev3: Number(params.entryDev3) || 0,
      tp2: Number(params.tp2) || 0,
      tp3: Number(params.tp3) || 0,
    };
    const r = runBacktestEngine(session, backParams, filteredCash, ohlcData.barsByTradingDay, ohlcData.sortedTradingDays);
    setResults(r);
    setActiveView('chart');
  }, [ohlcData, filteredCash, params, session]);

  const canRun = !!(ohlcData?.ohlcParsed.length && filteredCash.length);

  // Badge info
  const ohlcInfo = ohlcData?.ohlcParsed.length ? `${ohlcData.ohlcParsed.length.toLocaleString()} bars` : '';
  const tdInfo = ohlcData?.sortedTradingDays.length ? `${ohlcData.sortedTradingDays.length} trading days` : '';
  const ohlcRange = ohlcData?.ohlcParsed.length
    ? `${fmtDateTime(ohlcData.ohlcParsed[0].timestamp)} → ${fmtDateTime(ohlcData.ohlcParsed[ohlcData.ohlcParsed.length - 1].timestamp)} (UTC+8)` : '';
  const cashInfo = cashData?.cashParsed.length ? `${cashData.cashParsed.length} days` : '';
  const cashRange = cashData?.cashParsed.length
    ? `${fmtDate(cashData.cashParsed[0].date)} → ${fmtDate(cashData.cashParsed[cashData.cashParsed.length - 1].date)}` : '';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-8 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-emerald-400">1×7</span> Cash Arb Backtester
          </h1>
          <div className="text-xs text-white/30 mt-0.5">Topix / Nikkei 225 spread — mean reversion simulator</div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {ohlcInfo && <Badge text={`OHLC: ${ohlcInfo}`} />}
          {tdInfo && <Badge text={tdInfo} />}
          {ohlcRange && <Badge text={ohlcRange} />}
          {cashInfo && <Badge text={`Cash: ${cashInfo}`} />}
          {cashRange && <Badge text={cashRange} />}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1200px] mx-auto px-8 py-6">
        {/* File uploads */}
        <div className="grid grid-cols-2 gap-3 mb-5">
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

        {/* Date Range Picker */}
        {dateBounds && (
          <DateRangePicker
            minDate={dateBounds.min}
            maxDate={dateBounds.max}
            startDate={dateStart}
            endDate={dateEnd}
            onStartChange={setDateStart}
            onEndChange={setDateEnd}
            onReset={() => { setDateStart(dateBounds.min); setDateEnd(dateBounds.max); }}
          />
        )}

        {/* Params */}
        <ParamsPanel
          session={session}
          onSessionChange={s => {
            setSession(s);
            setResults(null);
            const def = s === 'lunch' ? LUNCH_DEFAULTS : NIGHT_DEFAULTS;
            setParams(prev => ({
              ...prev,
              entry: def.entry,
              tp: def.tp,
              sl: def.sl,
              entryEnd: def.entryEnd,
              backstop: def.backstop,
              entryDev2: def.entryDev2,
              entryDev3: def.entryDev3,
              tp2: def.tp2,
              tp3: def.tp3,
            }));
          }}
          params={params}
          onParamChange={handleParamChange}
          onRun={handleRun}
          canRun={canRun}
        />

        {/* Results */}
        {!results ? (
          <div className="text-center py-16 text-white/15 text-sm">
            Upload both data files to run backtest
          </div>
        ) : (
          <div>
            <StatsGrid stats={results.stats} />

            {/* View Tabs */}
            <div className="flex gap-0 mb-4 border-b border-white/[0.06]">
              <ViewTabButton label="Charts" active={activeView === 'chart'} onClick={() => setActiveView('chart')} />
              <ViewTabButton label={`Trade Log (${results.trades.length})`} active={activeView === 'log'} onClick={() => setActiveView('log')} />
              <ViewTabButton label="Debug Log" active={activeView === 'debug'} onClick={() => setActiveView('debug')} />
            </div>

            {activeView === 'chart' && <EquityChart equity={results.equity} dailyPnL={results.dailyPnL} />}
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
    <div className="text-[10px] text-white/30 px-2 py-0.5 bg-white/[0.03] rounded font-mono">
      {text}
    </div>
  );
}

function ViewTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`px-5 py-2 bg-transparent border-none border-b-2 text-xs font-semibold cursor-pointer tracking-wide uppercase transition-all ${
        active ? 'border-b-emerald-400 text-white/80' : 'border-b-transparent text-white/25 hover:text-white/40'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
