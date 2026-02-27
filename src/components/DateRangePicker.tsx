'use client';

interface DateRangePickerProps {
  minDate: string;    // yyyy-mm-dd
  maxDate: string;
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onReset: () => void;
}

export default function DateRangePicker({ minDate, maxDate, startDate, endDate, onStartChange, onEndChange, onReset }: DateRangePickerProps) {
  const isFiltered = startDate !== minDate || endDate !== maxDate;

  return (
    <div className="flex items-center gap-3 mb-5 p-3 bg-white/[0.02] rounded-lg border border-white/5">
      <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold shrink-0">Date Range</div>
      <input
        type="date"
        className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white/70 text-xs font-mono outline-none focus:border-emerald-500/40 transition-colors"
        value={startDate}
        min={minDate}
        max={endDate}
        onChange={e => onStartChange(e.target.value)}
      />
      <span className="text-white/20 text-xs">→</span>
      <input
        type="date"
        className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white/70 text-xs font-mono outline-none focus:border-emerald-500/40 transition-colors"
        value={endDate}
        min={startDate}
        max={maxDate}
        onChange={e => onEndChange(e.target.value)}
      />
      {isFiltered && (
        <button
          className="px-2 py-1 text-[10px] text-white/40 bg-white/5 rounded border border-white/[0.08] hover:bg-white/[0.08] transition-colors cursor-pointer"
          onClick={onReset}
        >
          Reset
        </button>
      )}
      {isFiltered && (
        <span className="text-[10px] text-amber-400/60 font-mono">filtered</span>
      )}
    </div>
  );
}
