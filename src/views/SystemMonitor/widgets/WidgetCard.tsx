import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface WidgetCardProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
  extraAction?: React.ReactNode;
  id?: string;
  isLive?: boolean;
}

export function WidgetCard({ 
  title, 
  icon, 
  loading, 
  error, 
  onRetry, 
  children, 
  extraAction, 
  id,
  isLive 
}: WidgetCardProps) {
  return (
    <div id={id} className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full hover:shadow-md hover:border-slate-200/60 transition-all duration-300">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-500">{icon}</span>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">{title}</h3>
            {isLive && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {extraAction || null}
          <button 
            onClick={onRetry}
            disabled={loading}
            title="Segarkan data widget ini"
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col justify-center min-h-[140px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-6 w-full gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-400 font-medium">Mengambil maklumat...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center p-4 gap-3 bg-rose-50/40 rounded-xl border border-rose-100/60 w-full">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            <div>
              <p className="text-xs font-extrabold text-slate-800">Ralat Pengambilan Data</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{error}</p>
            </div>
            <button 
              onClick={onRetry}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cuba Semula
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
