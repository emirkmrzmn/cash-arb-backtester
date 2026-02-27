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
  maxDistFromCash: number;
  tranche?: string;
}

export interface EquityPoint {
  idx: number;
  pnl: number;
  date: string;
}

export interface DailyPnLPoint {
  date: string;
  pnl: number;
}

export interface BacktestParams {
  entryDev: number;
  tp: number;
  sl: number;
  noSL: boolean;              // disable SL, purely time-based exits
  entryEndMin: number;
  backstopMin: number;
  ambiguous: 'conservative' | 'optimistic';
  allowReentry: boolean;
  // E1/E2/E3 scaled entries — each with own SL
  enableE2: boolean;
  enableE3: boolean;
  entryDev2: number;
  entryDev3: number;
  tp2: number;
  tp3: number;
  sl2: number;
  sl3: number;
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
  // Max distance from cash percentile stats
  maxDistMedian: string;
  maxDistP30: string;
  maxDistP10: string;
  // Tranche entry counts
  e1Count: number;
  e2Count: number;
  e3Count: number;
  enableE2: boolean;
  enableE3: boolean;
}

export interface BacktestResult {
  trades: Trade[];
  equity: EquityPoint[];
  dailyPnL: DailyPnLPoint[];
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
  entryDev2: 50,
  entryDev3: 65,
  tp2: 35,
  tp3: 50,
  sl2: 35,
  sl3: 15,
};

export const NIGHT_DEFAULTS = {
  entry: 80,
  tp: 150,
  sl: 200,
  entryEnd: '04:55',
  backstop: '05:00',
  entryDev2: 120,
  entryDev3: 160,
  tp2: 200,
  tp3: 250,
  sl2: 160,
  sl3: 120,
};
