'use client';

import { useRef } from 'react';

interface FileUploadProps {
  label: string;
  hint: string;
  loaded: boolean;
  loadedText?: string;
  onFile: (file: File) => void;
}

export default function FileUpload({ label, hint, loaded, loadedText, onFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`border border-dashed rounded-lg p-4 cursor-pointer transition-all ${
        loaded
          ? 'bg-emerald-500/5 border-emerald-500/20 border-solid'
          : 'border-white/10 bg-white/[0.015] hover:border-emerald-500/30'
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <div className="text-sm font-semibold text-emerald-400">{label}</div>
      <div className="text-xs text-white/25 mt-1">{loaded && loadedText ? loadedText : hint}</div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
