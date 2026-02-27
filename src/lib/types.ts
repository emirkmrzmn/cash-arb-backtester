export interface DateComponents {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
}

export interface Bar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CashRef {
  date: Date;
  lunchClose: number;
  nightClose: number;
  _raw: unknown;
  _comp: DateComponents;
}

export interface Trade {
  date: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: string;
  exitPrice: number;
  exitTime: string;
  pnl: number;
  exitReason: string;
  cashRef: number;
}

export interface EquityPoint {
  idx: number;
  pnl: number;
  date: string;
}

export interface BacktestParams {
  entryDev: number;
  tp: number;
  sl: number;
  entryEndMin: number;
  backstopMin: number;
  ambiguous: 'conservative' | 'optimistic';
  allowReentry: boolean;
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  flat: number;
  winRate: string;
  profitFactor: string;
  totalPnL: string;
  grossProfit: string;
  grossLoss: string;
  avgWin: string;
  avgLoss: string;
  maxDD: string;
  maxCL: number;
  maxCW: number;
  noTradeDays: number;
  totalDays: number;
}

export interface BacktestResult {
  trades: Trade[];
  equity: EquityPoint[];
  debugLog: string[];
  stats: BacktestStats;
}

export type Session = 'lunch' | 'night';

export const LUNCH_DEFAULTS = {
  entry: 35,
  tp: 20,
  sl: 50,
  entryEnd: '11:25',
  backstop: '11:45',
};

export const NIGHT_DEFAULTS = {
  entry: 80,
  tp: 150,
  sl: 200,
  entryEnd: '04:55',
  backstop: '05:00',
};
