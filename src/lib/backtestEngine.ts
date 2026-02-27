import { Bar, CashRef, BacktestParams, BacktestResult, Trade, EquityPoint, DailyPnLPoint, Session } from './types';
import { dateKey, fmtDate, fmtDateTime, makeDateTime, findNextTradingDay, keyToDate } from './dateUtils';

// ─── Tranche-based position for E1/E2/E3 ───
interface Tranche {
  level: number;       // 1, 2, or 3
  direction: 1 | -1;
  entryPrice: number;
  entryTime: Date;
  tp: number;          // TP distance for this tranche
  closed: boolean;
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: string;
  pnl?: number;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function runBacktestEngine(
  session: Session,
  params: BacktestParams,
  cashParsed: CashRef[],
  barsByTradingDay: Record<string, Bar[]>,
  sortedTradingDays: string[]
): BacktestResult {
  const { entryDev, tp, sl, noSL, entryEndMin, backstopMin, ambiguous, allowReentry,
          enableE2, enableE3, entryDev2, entryDev3, tp2, tp3, sl2, sl3 } = params;

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
  const dailyPnLMap: Record<string, number> = {};
  const debugLog: string[] = [];
  const allMaxDists: number[] = [];

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

  const tradingDates = cashParsed.map(r => r.date).filter(d => validCashDates.has(dateKey(d)));

  tradingDates.forEach(td => {
    const k = dateKey(td);
    const cashClose = cashMap[k];

    const tdBars = barsByTradingDay[k];
    if (!tdBars || !tdBars.length) {
      debugLog.push(fmtDate(td) + ' [' + k + ']: SKIP — no OHLC trading day');
      return;
    }

    // ── FILTER BARS FOR THIS SESSION ──
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

    // ── ENTRY WINDOW ──
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

    // ── MAX DISTANCE FROM CASH (track across all session bars) ──
    let maxDist = 0;
    sessionBars.forEach(b => {
      const distHigh = Math.abs(b.high - cashClose);
      const distLow = Math.abs(b.low - cashClose);
      maxDist = Math.max(maxDist, distHigh, distLow);
    });
    maxDist = Math.round(maxDist * 10) / 10;
    allMaxDists.push(maxDist);

    // ── THRESHOLDS (multi-level for E1/E2/E3) ──
    const longE1 = cashClose - entryDev;
    const shortE1 = cashClose + entryDev;
    const longE2 = enableE2 ? cashClose - entryDev2 : null;
    const shortE2 = enableE2 ? cashClose + entryDev2 : null;
    const longE3 = enableE3 ? cashClose - entryDev3 : null;
    const shortE3 = enableE3 ? cashClose + entryDev3 : null;

    const nextTDKeyForLog = session === 'night' ? findNextTradingDay(k, sortedTradingDays) : null;
    debugLog.push(
      fmtDate(td) + ' [' + k + ']: cash=' + cashClose +
      ' | E1 L@≤' + longE1 + ' S@≥' + shortE1 +
      (enableE2 ? ' E2 L@≤' + longE2 + ' S@≥' + shortE2 : '') +
      (enableE3 ? ' E3 L@≤' + longE3 + ' S@≥' + shortE3 : '') +
      ' | maxDist=' + maxDist +
      ' | ' + sessionBars.length + ' bars [' + fmtDateTime(sessionBars[0].timestamp) + '→' + fmtDateTime(sessionBars[sessionBars.length - 1].timestamp) + ']' +
      (nextTDKeyForLog ? ' carry→' + nextTDKeyForLog : '')
    );

    // ── SIMULATION (with E1/E2/E3 tranche support) ──
    const useScaledEntry = enableE2 || enableE3;

    if (useScaledEntry) {
      // ═══ SCALED ENTRY MODE ═══
      const tranches: Tranche[] = [];
      let posDirection: 1 | -1 | null = null;
      let e1Triggered = false, e2Triggered = false, e3Triggered = false;
      let slTriggered = false; // once any SL fires, no more entries for the day

      function closeAllTranches(exitPrice: number, exitTime: Date, reason: string) {
        tranches.filter(t => !t.closed).forEach(t => {
          const pnl = t.direction === 1 ? (exitPrice - t.entryPrice) : (t.entryPrice - exitPrice);
          t.pnl = Math.round(pnl * 10) / 10;
          t.exitPrice = Math.round(exitPrice * 10) / 10;
          t.exitTime = exitTime;
          t.exitReason = reason;
          t.closed = true;
        });
      }

      function closeTranche(t: Tranche, exitPrice: number, exitTime: Date, reason: string) {
        const pnl = t.direction === 1 ? (exitPrice - t.entryPrice) : (t.entryPrice - exitPrice);
        t.pnl = Math.round(pnl * 10) / 10;
        t.exitPrice = Math.round(exitPrice * 10) / 10;
        t.exitTime = exitTime;
        t.exitReason = reason;
        t.closed = true;
      }

      for (let i = 0; i < sessionBars.length; i++) {
        const bar = sessionBars[i];
        const isLast = i === sessionBars.length - 1;
        const inEntryWindow = bar.timestamp <= entryWindowEnd;
        const openTranches = tranches.filter(t => !t.closed);

        // Check for new tranche entries (within entry window, blocked after any SL)
        if (inEntryWindow && !slTriggered) {
          if (!e1Triggered) {
            if (bar.low <= longE1) {
              posDirection = 1; e1Triggered = true;
              tranches.push({ level: 1, direction: 1, entryPrice: longE1, entryTime: bar.timestamp, tp, closed: false });
              debugLog.push('  <span class="dbg-entry">E1 LONG @ ' + longE1 + ' bar=' + fmtDateTime(bar.timestamp) + '</span>');
            } else if (bar.high >= shortE1) {
              posDirection = -1; e1Triggered = true;
              tranches.push({ level: 1, direction: -1, entryPrice: shortE1, entryTime: bar.timestamp, tp, closed: false });
              debugLog.push('  <span class="dbg-entry">E1 SHORT @ ' + shortE1 + ' bar=' + fmtDateTime(bar.timestamp) + '</span>');
            }
          }
          if (enableE2 && e1Triggered && !e2Triggered && posDirection !== null) {
            if (posDirection === 1 && longE2 !== null && bar.low <= longE2) {
              e2Triggered = true;
              tranches.push({ level: 2, direction: 1, entryPrice: longE2, entryTime: bar.timestamp, tp: tp2, closed: false });
              debugLog.push('  <span class="dbg-entry">E2 LONG @ ' + longE2 + ' bar=' + fmtDateTime(bar.timestamp) + '</span>');
            } else if (posDirection === -1 && shortE2 !== null && bar.high >= shortE2) {
              e2Triggered = true;
              tranches.push({ level: 2, direction: -1, entryPrice: shortE2, entryTime: bar.timestamp, tp: tp2, closed: false });
              debugLog.push('  <span class="dbg-entry">E2 SHORT @ ' + shortE2 + ' bar=' + fmtDateTime(bar.timestamp) + '</span>');
            }
          }
          if (enableE3 && e2Triggered && !e3Triggered && posDirection !== null) {
            if (posDirection === 1 && longE3 !== null && bar.low <= longE3) {
              e3Triggered = true;
              tranches.push({ level: 3, direction: 1, entryPrice: longE3, entryTime: bar.timestamp, tp: tp3, closed: false });
              debugLog.push('  <span class="dbg-entry">E3 LONG @ ' + longE3 + ' bar=' + fmtDateTime(bar.timestamp) + '</span>');
            } else if (posDirection === -1 && shortE3 !== null && bar.high >= shortE3) {
              e3Triggered = true;
              tranches.push({ level: 3, direction: -1, entryPrice: shortE3, entryTime: bar.timestamp, tp: tp3, closed: false });
              debugLog.push('  <span class="dbg-entry">E3 SHORT @ ' + shortE3 + ' bar=' + fmtDateTime(bar.timestamp) + '</span>');
            }
          }
        }

        // Check exits on open tranches
        const stillOpen = tranches.filter(t => !t.closed);
        if (stillOpen.length === 0) {
          if (!inEntryWindow || slTriggered) break;
          if (allowReentry && tranches.length > 0) {
            posDirection = null; e1Triggered = false; e2Triggered = false; e3Triggered = false;
          }
          continue;
        }

        // SL check per tranche (individual SLs) — skip if noSL
        if (!noSL) {
          const slMap: Record<number, number> = { 1: sl, 2: sl2, 3: sl3 };
          let anySLHit = false;
          stillOpen.forEach(t => {
            if (t.closed) return;
            const trancheSL = slMap[t.level] || sl;
            const slPx = t.direction === 1 ? t.entryPrice - trancheSL : t.entryPrice + trancheSL;
            const slHit = t.direction === 1 ? bar.low <= slPx : bar.high >= slPx;
            if (slHit) {
              closeTranche(t, slPx, bar.timestamp, 'SL');
              debugLog.push('  <span class="dbg-exit-sl">E' + t.level + ' SL @ ' + Math.round(slPx * 10) / 10 + ' pnl=' + (t.pnl! > 0 ? '+' : '') + t.pnl + '</span>');
              anySLHit = true;
            }
          });
          // Once any SL fires, no more entries for the rest of this trading day
          if (anySLHit) {
            slTriggered = true;
            // If all tranches now closed, done for the day
            if (tranches.filter(t => !t.closed).length === 0) break;
          }
        }

        // TP check per tranche
        stillOpen.forEach(t => {
          if (t.closed) return;
          const tpPx = t.direction === 1 ? t.entryPrice + t.tp : t.entryPrice - t.tp;
          const tpHit = t.direction === 1 ? bar.high >= tpPx : bar.low <= tpPx;
          if (tpHit) {
            closeTranche(t, tpPx, bar.timestamp, 'TP');
            debugLog.push('  <span class="dbg-exit-tp">E' + t.level + ' TP @ ' + Math.round(tpPx * 10) / 10 + ' pnl=' + (t.pnl! > 0 ? '+' : '') + t.pnl + '</span>');
          }
        });

        // Time backstop on last bar
        if (isLast) {
          tranches.filter(t => !t.closed).forEach(t => {
            closeTranche(t, bar.close, bar.timestamp, 'TIME');
            debugLog.push('  <span class="dbg-exit-time">E' + t.level + ' TIME @ ' + bar.close + ' pnl=' + (t.pnl! > 0 ? '+' : '') + t.pnl + '</span>');
          });
        }
      }

      // Convert tranches to trade records
      tranches.filter(t => t.closed).forEach(t => {
        const rounded = t.pnl!;
        trades.push({
          date: fmtDate(td),
          direction: t.direction === 1 ? 'LONG' : 'SHORT',
          entryPrice: t.entryPrice,
          entryTime: fmtDateTime(t.entryTime),
          exitPrice: t.exitPrice!,
          exitTime: fmtDateTime(t.exitTime!),
          pnl: rounded,
          exitReason: t.exitReason!,
          cashRef: cashClose,
          maxDistFromCash: maxDist,
          tranche: 'E' + t.level,
        });
        cumPnL += rounded;
        equity.push({ idx: trades.length, pnl: Math.round(cumPnL * 10) / 10, date: fmtDate(td) });
        const dateStr = fmtDate(td);
        dailyPnLMap[dateStr] = (dailyPnLMap[dateStr] || 0) + rounded;
      });

    } else {
      // ═══ SINGLE ENTRY MODE (original logic) ═══
      let position: { direction: 1 | -1; entryPrice: number; entryTime: Date } | null = null;

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
          maxDistFromCash: maxDist,
        });
        cumPnL += rounded;
        equity.push({ idx: trades.length, pnl: Math.round(cumPnL * 10) / 10, date: fmtDate(td) });
        const dateStr = fmtDate(td);
        dailyPnLMap[dateStr] = (dailyPnLMap[dateStr] || 0) + rounded;
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
          if (bar.low <= longE1) { entryDir = 1; entryPx = longE1; entered = true; }
          else if (bar.high >= shortE1) { entryDir = -1; entryPx = shortE1; entered = true; }
          if (!entered) continue;

          position = { direction: entryDir, entryPrice: entryPx, entryTime: bar.timestamp };
          debugLog.push('  <span class="dbg-entry">ENTRY ' + (entryDir === 1 ? 'LONG' : 'SHORT') + ' @ ' + entryPx + ' bar=' + fmtDateTime(bar.timestamp) + ' [O=' + bar.open + ' H=' + bar.high + ' L=' + bar.low + ' C=' + bar.close + ']</span>');

          const tpPx = entryDir === 1 ? entryPx + tp : entryPx - tp;
          const slPx = entryDir === 1 ? entryPx - sl : entryPx + sl;
          const tpHit = entryDir === 1 ? bar.high >= tpPx : bar.low <= tpPx;
          const slHit = noSL ? false : (entryDir === 1 ? bar.low <= slPx : bar.high >= slPx);

          if (isLast) {
            if (tpHit && !slHit) closeTrade(tpPx, bar.timestamp, 'TP');
            else if (slHit && !tpHit) { closeTrade(slPx, bar.timestamp, 'SL'); break; }
            else if (tpHit && slHit) { closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)'); if (ambiguous === 'conservative') break; }
            else closeTrade(bar.close, bar.timestamp, 'TIME');
            if (allowReentry) continue; else break;
          }
          if (tpHit && slHit) { closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)'); if (ambiguous === 'conservative') break; if (allowReentry) continue; else break; }
          if (tpHit) { closeTrade(tpPx, bar.timestamp, 'TP'); if (allowReentry) continue; else break; }
          if (slHit) { closeTrade(slPx, bar.timestamp, 'SL'); break; }
          continue;
        }

        const dir = position.direction;
        const tpPx = dir === 1 ? position.entryPrice + tp : position.entryPrice - tp;
        const slPx = dir === 1 ? position.entryPrice - sl : position.entryPrice + sl;
        const tpHit = dir === 1 ? bar.high >= tpPx : bar.low <= tpPx;
        const slHit = noSL ? false : (dir === 1 ? bar.low <= slPx : bar.high >= slPx);

        if (isLast) {
          if (tpHit && !slHit) closeTrade(tpPx, bar.timestamp, 'TP');
          else if (slHit && !tpHit) closeTrade(slPx, bar.timestamp, 'SL');
          else if (tpHit && slHit) closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)');
          else closeTrade(bar.close, bar.timestamp, 'TIME');
          break;
        }
        if (tpHit && slHit) { closeTrade(ambiguous === 'conservative' ? slPx : tpPx, bar.timestamp, (ambiguous === 'conservative' ? 'SL' : 'TP') + ' (ambig)'); if (ambiguous === 'conservative') break; if (allowReentry && inEntryWindow) continue; else break; }
        if (tpHit) { closeTrade(tpPx, bar.timestamp, 'TP'); if (allowReentry && inEntryWindow) continue; else break; }
        if (slHit) { closeTrade(slPx, bar.timestamp, 'SL'); break; }
      }

      if (position) {
        const lb = sessionBars[sessionBars.length - 1];
        closeTrade(lb.close, lb.timestamp, 'TIME');
      }
    }
  });

  // ── STATS ──
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

  // Daily P&L
  const dailyPnL: DailyPnLPoint[] = Object.entries(dailyPnLMap)
    .map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Max distance percentiles
  const maxDistMedian = percentile(allMaxDists, 50);
  const maxDistP30 = percentile(allMaxDists, 30);
  const maxDistP10 = percentile(allMaxDists, 10);

  // Tranche entry counts
  const e1Count = trades.filter(t => !t.tranche || t.tranche === 'E1').length;
  const e2Count = trades.filter(t => t.tranche === 'E2').length;
  const e3Count = trades.filter(t => t.tranche === 'E3').length;

  return {
    trades,
    equity,
    dailyPnL,
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
      maxDistMedian: maxDistMedian.toFixed(1),
      maxDistP30: maxDistP30.toFixed(1),
      maxDistP10: maxDistP10.toFixed(1),
      e1Count,
      e2Count,
      e3Count,
      enableE2,
      enableE3,
    },
  };
}
