'use client';

interface DebugLogProps {
  log: string[];
}

export default function DebugLog({ log }: DebugLogProps) {
  return (
    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5 text-[11px] text-white/45 font-mono max-h-[400px] overflow-y-auto leading-relaxed">
      {log.slice(0, 500).map((line, i) => (
        <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
      ))}
      {log.length === 0 && <div className="text-amber-400">No entries</div>}
    </div>
  );
}
