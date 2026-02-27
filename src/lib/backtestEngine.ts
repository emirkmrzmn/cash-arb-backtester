import { Bar, CashRef, BacktestParams, BacktestResult, Trade, EquityPoint, Session } from './types';
import { dateKey, fmtDate, fmtDateTime, makeDateTime, findNextTradingDay, keyToDate } from './dateUtils';

interface Position {
  direction: 1 | -1;
  entryPrice: number;
  entryTime: Date;
}

export function runBacktestEngine(
  session: Session,
  params: BacktestParams,
  cashParsed: CashRef[],
  barsByTradingDay: Record<string, Bar[]>,
  sortedTradingDays: string[]
): BacktestResult {
  const { entryDev, tp, sl, entryEndMin, backstopMin, ambiguous, allowReentry } = params;

  // Cash lookup
  const cashMap: Record<string, number> = {};
  const validCashDates = new Set<string>();
  cashParsed.forEach(r => {
    const k = dateKey(r.date);
    const val = session === 'lunch' ? r.lunchClose : r.nightClose;
    if (val != null && !isNaN(val)) {
      cashMap[k] = val;
      validCashDates.add(k);
    }
  });

  const trades: Trade[] = [];
  let cumPnL = 0;
  const equity: EquityPoint[] = [];
  const debugLog: string[] = [];

  // Diagnostics
  debugLog.push('<span class="dbg-header">══ PARSE DIAGNOSTICS ══</span>');
  debugLog.push(
    'Cash (first 5): ' +
    cashParsed.slice(0, 5).map(r =>
      'raw=' + JSON.stringify(r._raw) + ' → ' + fmtDate(r.date) + ' [' + dateKey(r.date) + ']'
    ).join(' | ')
  );
  debugLog.push('');
  debugLog.push(
    'Trading days (first 5): ' +
    sortedTradingDays.slice(0, 5).map(k => {
      const bars = barsByTradingDay[k];
      return k + ' (' + bars.length + ' bars, ' + fmtDateTime(bars[0].timestamp) + '→' + fmtDateTime(bars[bars.length - 1].timestamp) + ')';
    }).join(' | ')
  );
  debugLog.push('');

  const cashKeys = [...validCashDates].sort();
  const overlap = cashKeys.filter(k => sortedTradingDays.includes(k));
  debugLog.push('Cash dates: ' + cashKeys.length + ' | OHLC trading days: ' + sortedTradingDays.length + ' | Overlap: ' + overlap.length);
  if (overlap.length === 0) {
    debugLog.push('<span class="dbg-warn">⚠ ZERO MATCHING DATES</span>');
    debugLog.push('Cash: ' + cashKeys.slice(0, 8).join(', '));
    debugLog.push('OHLC: ' + sortedTradingDays.slice(0, 8).join(', '));
  }
  debugLog.push('');
  debugLog.push('<span class="dbg-header">══ TRADES ══</span>');

  // Iterate over cash dates that have matching OHLC trading days
  const tradingDates = cashParsed.map(r => r.date).filter(d => validCashDates.has(dateKey(d)));

  tradingDates.forEach(td => {
    const k = dateKey(td);
    const cashClose = cashMap[k];

    const tdBars = barsByTradingDay[k];
    if (!tdBars || !tdBars.length) {
      debugLog.push(fmtDate(td) + ' [' + k + ']: SKIP — no OHLC trading day');
      return;
    }

    // Filter bars for this session
    let sessionBars: Bar[] = [];

    if (session === 'lunch') {
      const lunchStart = makeDateTime(td, 10 * 60 + 30);
      const lunchEnd = makeDateTime(td, backstopMin);
      sessionBars = tdBars.filter(b => b.timestamp >= lunchStart && b.timestamp <= lunchEnd);

      if (sessionBars.length === 0) {
        debugLog.push(fmtDate(td) + ' [' + k + ']: SKIP — no bars in lunch window');
        return;
      }
    } else {
      // Night session
      const nightStart = makeDateTime(td, 16 * 60);
      const phase1 = tdBars.filter(b => b.timestamp >= nightStart);

      const nextTDKey = findNextTradingDay(k, sortedTradingDays);
      let phase2: Bar[] = [];
      if (nextTDKey) {
        const ntd = keyToDate(nextTDKey);
        const backstopDT = makeDateTime(ntd, backstopMin);
        const nextBars = barsByTradingDay[nextTDKey] || [];
        phase2 = nextBars.filter(b => b.timestamp <= backstopDT);
      }

      sessionBars = [...phase1, ...phase2];
      sessionBars.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (sessionBars.length === 0) {
        debugLog.push(fmtDate(td) + ' [' + k + ']: SKIP — no bars in night window');
        return;
      }
    }

    // Entry window
    let entryWindowEnd: Date;
    if (session === 'lunch') {
      entryWindowEnd = makeDateTime(td, entryEndMin);
    } else {
      if (entryEndMin < 16 * 60) {
        const nextCal = new Date(td);
        nextCal.setDate(nextCal.getDate() + 1);
        entryWindowEnd = makeDateTime(nextCal, entryEndMin);
      } else {
        entryWindowEnd = makeDateTime(td, entryEndMin);
      }
    }

    // Thresholds
    const longEntry = cashClose - entryDev;
    const shortEntry = cashClose + entryDev;

    const nextTDKeyForLog = session === 'night' ? findNextTradingDay(k, sortedTradingDays) : null;
    debugLog.push(
      fmtDate(td) + ' [' + k + ']: cash=' + cashClose +
      ' | L@≤' + longEntry + ' S@≥' + shortEntry +
      ' | ' + sessionBars.length + ' bars [' + fmtDateTime(sessionBars[0].timestamp) + '→' + fmtDateTime(sessionBars[sessionBars.length - 1].timestamp) + ']' +
      (nextTDKeyForLog ? ' carry→' + nextTDKeyForLog : '')
    );

    // Simulation
    let position: Position | null = null;

    function closeTrade(exitPrice: number, exitTime: Date, reason: string) {
      const dir = position!.direction;
      const pnl = dir === 1 ? (exitPrice - position!.entryPrice) : (position!.entryPrice - exitPrice);
      const rounded = Math.round(pnl * 10) / 10;
      trades.push({
        date: fmtDate(td),
        direction: dir === 1 ? 'LONG' : 'SHORT',
        entryPrice: position!.entryPrice,
        entryTime: fmtDateTime(position!.entryTime),
        exitPrice: Math.round(exitPrice * 10) / 10,
        exitTime: fmtDateTime(exitTime),
        pnl: rounded,
        exitReason: reason,
        cashRef: cashClose,
      });
      cumPnL += rounded;
      equity.push({ idx: trades.length, pnl: Math.round(cumPnL * 10) / 10, date: fmtDate(td) });
      const cls = reason.startsWith('TP') ? 'dbg-exit-tp' : reason.startsWith('SL') ? 'dbg-exit-sl' : 'dbg-exit-time';
      debugLog.push('  <span class="' + cls + '">EXIT ' + reason + ' @ ' + (Math.round(exitPrice * 10) / 10) + ' pnl=' + (rounded > 0 ? '+' : '') + rounded + '</span>');
      position = null;
    }

    for (let i = 0; i < sessionBars.length; i++) {
      const bar = sessionBars[i];
      const isLast = i === sessionBars.length - 1;
      const inEntryWindow = bar.timestamp <= entryWindowEnd;

      if (!position) {
        if (!inEntryWindow) break;
        let entered = false, entryDir: 1 | -1 = 1, entryPx = 0;
        if (bar.low <= longEntry) { entryDir = 1; entryPx = longEntry; entered = true; }
        else if (bar.high >= shortEntry) { entryDir = -1; entryPx = shortEntry; entered = true; }
        if (!entered) continue;

        position = { direction: entryDir, entryPrice: entryPx, entryTime: bar.timestamp };
        debugLog.push('  <span class="dbg-entry">ENTRY ' + (entryDir === 1 ? 'LONG' : 'SHORT') + ' @ ' + entryPx + ' bar=' + fmtDateTime(bar.timestamp) + ' [O=' + bar.open + ' H=' + bar.high + ' L=' + bar.low + ' C=' + bar.close + ']</span>');

        const tpPx = entryDir === 1 ? entryPx + tp : entryPx - tp;
        const slPx = entryDir === 1 ? entryPx - sl : entryPx + sl;
        const tpHit = entryDir === 1 ? bar.high >= tpPx : bar.low <= tpPx;
        const slHit = entryDir === 1 ? bar.low <= slPx : bar.high >= slPx;

        if (isLast) {
          if (tpHit && !slHit) closeTrade(tpPx, bar.timestamp, 'TP');
          else if (slHit && !tpHit) closeTrade(slPx, bar.timestamp, 'SL');
          else if (tpHit && slHit) closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)');
          else closeTrade(bar.close, bar.timestamp, 'TIME');
          if (allowReentry) continue; else break;
        }
        if (tpHit && slHit) { closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)'); if (allowReentry) continue; else break; }
        if (tpHit) { closeTrade(tpPx, bar.timestamp, 'TP'); if (allowReentry) continue; else break; }
        if (slHit) { closeTrade(slPx, bar.timestamp, 'SL'); if (allowReentry) continue; else break; }
        continue;
      }

      // Position open — check exits
      const dir = position.direction;
      const tpPx = dir === 1 ? position.entryPrice + tp : position.entryPrice - tp;
      const slPx = dir === 1 ? position.entryPrice - sl : position.entryPrice + sl;
      const tpHit = dir === 1 ? bar.high >= tpPx : bar.low <= tpPx;
      const slHit = dir === 1 ? bar.low <= slPx : bar.high >= slPx;

      if (isLast) {
        if (tpHit && !slHit) closeTrade(tpPx, bar.timestamp, 'TP');
        else if (slHit && !tpHit) closeTrade(slPx, bar.timestamp, 'SL');
        else if (tpHit && slHit) closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)');
        else closeTrade(bar.close, bar.timestamp, 'TIME');
        break;
      }
      if (tpHit && slHit) { closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)'); if (allowReentry && inEntryWindow) continue; else break; }
      if (tpHit) { closeTrade(tpPx, bar.timestamp, 'TP'); if (allowReentry && inEntryWindow) continue; else break; }
      if (slHit) { closeTrade(slPx, bar.timestamp, 'SL'); if (allowReentry && inEntryWindow) continue; else break; }
    }

    if (position) {
      const lb = sessionBars[sessionBars.length - 1];
      closeTrade(lb.close, lb.timestamp, 'TIME');
    }
  });

  // Stats
  const n = trades.length;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const flat = trades.filter(t => t.pnl === 0);
  const gp = wins.reduce((s, t) => s + t.pnl, 0);
  const gl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  let peak = 0, maxDD = 0, run = 0;
  trades.forEach(t => { run += t.pnl; if (run > peak) peak = run; const dd = peak - run; if (dd > maxDD) maxDD = dd; });

  let maxCL = 0, maxCW = 0, st = 0;
  trades.forEach(t => { if (t.pnl < 0) { st++; if (st > maxCL) maxCL = st; } else st = 0; });
  st = 0;
  trades.forEach(t => { if (t.pnl > 0) { st++; if (st > maxCW) maxCW = st; } else st = 0; });

  const tds = new Set(trades.map(t => t.date));
  const noTrade = tradingDates.filter(td => !tds.has(fmtDate(td))).length;

  return {
    trades,
    equity,
    debugLog,
    stats: {
      totalTrades: n,
      wins: wins.length,
      losses: losses.length,
      flat: flat.length,
      winRate: n > 0 ? (wins.length / n * 100).toFixed(1) : '0.0',
      profitFactor: gl > 0 ? (gp / gl).toFixed(2) : (gp > 0 ? '∞' : '0.00'),
      totalPnL: cumPnL.toFixed(1),
      grossProfit: gp.toFixed(1),
      grossLoss: gl.toFixed(1),
      avgWin: wins.length > 0 ? (gp / wins.length).toFixed(1) : '0',
      avgLoss: losses.length > 0 ? (gl / losses.length).toFixed(1) : '0',
      maxDD: maxDD.toFixed(1),
      maxCL,
      maxCW,
      noTradeDays: noTrade,
      totalDays: tradingDates.length,
    },
  };
}
