import * as XLSX from 'xlsx';
import { Bar, CashRef } from './types';
import { parseDateValue, detectDateOrder, addHoursComp, makeLocal, getTradingDay, dateKey } from './dateUtils';

export interface ParsedData {
  ohlcParsed: Bar[];
  barsByTradingDay: Record<string, Bar[]>;
  sortedTradingDays: string[];
}

export interface ParsedCash {
  cashParsed: CashRef[];
}

export function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  const isCSV = /\.csv$/i.test(file.name);

  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        if (isCSV) {
          // CSV: read as text to preserve raw date strings (avoid SheetJS locale-dependent date coercion)
          const text = e.target!.result as string;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) { resolve([]); return; }
          const headers = lines[0].split(',').map(h => h.trim());
          const rows: Record<string, unknown>[] = [];
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            const row: Record<string, unknown> = {};
            headers.forEach((h, j) => {
              const v = vals[j] ?? '';
              // Keep date/time columns as strings, parse numbers for everything else
              const num = Number(v);
              row[h] = v === '' ? null : (isNaN(num) ? v : num);
            });
            rows.push(row);
          }
          resolve(rows);
        } else {
          // XLSX: use SheetJS (serial dates are unambiguous)
          const d = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(d, { type: 'array', cellDates: false });
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
          resolve(json);
        }
      } catch (err) {
        reject(err);
      }
    };
    r.onerror = reject;
    if (isCSV) {
      r.readAsText(file);
    } else {
      r.readAsArrayBuffer(file);
    }
  });
}

export function parseOhlc(raw: Record<string, unknown>[]): ParsedData {
  const ohlcParsed: Bar[] = [];
  if (!raw || !raw.length) return { ohlcParsed, barsByTradingDay: {}, sortedTradingDays: [] };

  const keys = Object.keys(raw[0]);
  const tsK = keys.find(k => /time|date/i.test(k));
  const oK = keys.find(k => /^open/i.test(k));
  const hK = keys.find(k => /^high/i.test(k));
  const lK = keys.find(k => /^low/i.test(k));
  const cK = keys.find(k => /^close/i.test(k));

  const dateOrder = tsK ? detectDateOrder(raw.map(r => r[tsK])) : 'MDY';

  raw.forEach(row => {
    if (!tsK) return;
    const comp = parseDateValue(row[tsK], dateOrder);
    if (!comp) return;
    const utc8 = addHoursComp(comp, 8);
    const ts = makeLocal(utc8.year, utc8.month, utc8.day, utc8.hours, utc8.minutes);
    ohlcParsed.push({
      timestamp: ts,
      open: parseFloat(String(row[oK!])) || 0,
      high: parseFloat(String(row[hK!])) || 0,
      low: parseFloat(String(row[lK!])) || 0,
      close: parseFloat(String(row[cK!])) || 0,
    });
  });
  ohlcParsed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Group bars by trading day
  const barsByTradingDay: Record<string, Bar[]> = {};
  ohlcParsed.forEach(bar => {
    const td = getTradingDay(bar.timestamp);
    if (!td) return; // 05:00-07:44 gap
    if (!barsByTradingDay[td]) barsByTradingDay[td] = [];
    barsByTradingDay[td].push(bar);
  });

  const sortedTradingDays = Object.keys(barsByTradingDay).sort();

  // Sort bars within each trading day
  for (const k in barsByTradingDay) {
    barsByTradingDay[k].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  return { ohlcParsed, barsByTradingDay, sortedTradingDays };
}

export function parseCash(raw: Record<string, unknown>[]): ParsedCash {
  const cashParsed: CashRef[] = [];
  if (!raw || !raw.length) return { cashParsed };

  const keys = Object.keys(raw[0]);
  const dK = keys.find(k => /date/i.test(k));
  const lK = keys.find(k => /lunch/i.test(k));
  const nK = keys.find(k => /night/i.test(k));

  const cashDateOrder = dK ? detectDateOrder(raw.map(r => r[dK])) : 'MDY';

  raw.forEach(row => {
    if (!dK) return;
    const comp = parseDateValue(row[dK], cashDateOrder);
    if (!comp) return;
    const d = makeLocal(comp.year, comp.month, comp.day, 0, 0);
    cashParsed.push({
      date: d,
      lunchClose: parseFloat(String(row[lK!])),
      nightClose: parseFloat(String(row[nK!])),
      _raw: row[dK],
      _comp: comp,
    });
  });
  cashParsed.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { cashParsed };
}
