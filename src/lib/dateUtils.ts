import { DateComponents } from './types';

const TRADING_DAY_START_MIN = 7 * 60 + 45; // 07:45 = 465 minutes
const TRADING_DAY_END_MIN = 5 * 60;        // 05:00 = 300 minutes

export function excelSerialToUTC(serial: number): DateComponents {
  const d = new Date((serial - 25569) * 86400000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

export function parseDateValue(v: unknown): DateComponents | null {
  if (typeof v === 'number') return excelSerialToUTC(v);
  if (v instanceof Date) {
    return {
      year: v.getUTCFullYear(),
      month: v.getUTCMonth() + 1,
      day: v.getUTCDate(),
      hours: v.getUTCHours(),
      minutes: v.getUTCMinutes(),
    };
  }
  if (typeof v === 'string') {
    let m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/);
    if (m) {
      let yr = parseInt(m[3]);
      if (yr < 100) yr += 2000;
      return { year: yr, month: parseInt(m[1]), day: parseInt(m[2]), hours: parseInt(m[4]), minutes: parseInt(m[5]) };
    }
    m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      let yr = parseInt(m[3]);
      if (yr < 100) yr += 2000;
      return { year: yr, month: parseInt(m[1]), day: parseInt(m[2]), hours: 0, minutes: 0 };
    }
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
    }
  }
  return null;
}

export function makeLocal(y: number, mo: number, d: number, h?: number, mi?: number): Date {
  return new Date(y, mo - 1, d, h || 0, mi || 0);
}

export function addHoursComp(c: DateComponents, h: number): DateComponents {
  const d = new Date(c.year, c.month - 1, c.day, c.hours + h, c.minutes);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

export function dateKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function fmtDate(d: Date | null): string {
  if (!d) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

export function fmtDateTime(d: Date | null): string {
  if (!d) return '';
  return fmtDate(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function parseTimeStr(s: string): number | null {
  const p = s.split(':');
  return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : null;
}

export function makeDateTime(base: Date, min: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(min / 60), min % 60);
}

export function keyToDate(k: string): Date {
  const p = k.split('-');
  return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
}

export function timeInMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function getTradingDay(timestamp: Date): string | null {
  const mins = timeInMinutes(timestamp);
  if (mins >= TRADING_DAY_START_MIN) {
    return dateKey(timestamp);
  } else if (mins < TRADING_DAY_END_MIN) {
    const prev = new Date(timestamp);
    prev.setDate(prev.getDate() - 1);
    return dateKey(prev);
  } else {
    return null; // 05:00-07:44 gap
  }
}

export function findNextTradingDay(afterKey: string, sortedTradingDays: string[]): string | null {
  const idx = sortedTradingDays.indexOf(afterKey);
  if (idx >= 0 && idx < sortedTradingDays.length - 1) return sortedTradingDays[idx + 1];
  for (let i = 0; i < sortedTradingDays.length; i++) {
    if (sortedTradingDays[i] > afterKey) return sortedTradingDays[i];
  }
  return null;
}
