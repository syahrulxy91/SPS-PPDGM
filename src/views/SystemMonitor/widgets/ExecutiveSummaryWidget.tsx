import React from 'react';
import { Server, AlertTriangle } from 'lucide-react';
import { ExecutiveSummary, MonitoringSettings } from '../../../types/monitoring';

interface ExecutiveSummaryWidgetProps {
  summary: ExecutiveSummary | null;
  loading: boolean;
  error: string | null;
  settings: MonitoringSettings | null;
  onRetry: () => void;
  isLive: boolean;
}

export function ExecutiveSummaryWidget({ 
  summary, 
  loading, 
  error, 
  settings, 
  onRetry,
  isLive 
}: ExecutiveSummaryWidgetProps) {
  if (loading) {
    return (
      <div className="bg-slate-900 text-white rounded-2xl p-6 h-32 animate-pulse flex items-center justify-center">
        <span className="text-xs text-slate-400">Memuatkan rumusan eksekutif...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-950 text-rose-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
        <p className="text-xs font-bold text-center">Gagal memuatkan ringkasan eksekutif: {error}</p>
        <button onClick={onRetry} className="px-3 py-1 bg-rose-800 text-white text-[11px] font-bold rounded-lg cursor-pointer">
          Cuba Semula
        </button>
      </div>
    );
  }

  if (!summary) return null;

  // Threshold Checks
  const thresholds = settings?.thresholds;
  const isFailedUploadsHigh = thresholds && summary.failedUploads > thresholds.failedUploadsWarning;
  const isRateLimitsHigh = thresholds && summary.rateLimitBlocks > thresholds.rateLimitEventsAlert;

  const hasSystemWarnings = isFailedUploadsHigh || isRateLimitsHigh || summary.health !== 'HEALTHY';

  return (
    <div id="executive-summary" className="bg-gradient-to-r from-slate-900 to-[#0A192F] text-white rounded-2xl p-6 shadow-md border border-[#1B2C4E]/40 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Server className="w-40 h-40" />
      </div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-indigo-300 font-black tracking-widest text-[10px] uppercase font-mono border border-white/5">
              Rumusan Eksekutif
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-bold uppercase tracking-wider font-mono border border-indigo-500/30">
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping"></span>
                Live
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
            Status Keseluruhan: {summary.health === 'HEALTHY' && !hasSystemWarnings ? 'Lancar & Selamat' : 'Memerlukan Perhatian'}
            {hasSystemWarnings && (
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            )}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {hasSystemWarnings 
              ? 'Beberapa metrik dikesan melebihi ambang amaran atau status kesihatan komponen tidak optimum.' 
              : 'Kesemua sensor observabiliti melaporkan aktiviti dalam had operasi selamat tanpa sebarang serangan dikesan.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 shrink-0">
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kesihatan</p>
            <p className={`text-xs font-black mt-1 ${summary.health === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {summary.health}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Muat Naik</p>
            <p className="text-xs font-black mt-1 text-white">{summary.todayUploads}</p>
          </div>
          <div className={`bg-white/5 border rounded-xl p-3 text-center ${isFailedUploadsHigh ? 'border-rose-500/40 bg-rose-500/10' : 'border-white/5'}`}>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              Gagal
              {isFailedUploadsHigh && <AlertTriangle className="w-3 h-3 text-rose-400" title={`Melebihi had ${thresholds?.failedUploadsWarning}`} />}
            </p>
            <p className={`text-xs font-black mt-1 ${summary.failedUploads > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {summary.failedUploads}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aktiviti Sec</p>
            <p className="text-xs font-black mt-1 text-white">{summary.securityEvents}</p>
          </div>
          <div className={`bg-white/5 border rounded-xl p-3 text-center ${isRateLimitsHigh ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/5'}`}>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              Rate Limit
              {isRateLimitsHigh && <AlertTriangle className="w-3 h-3 text-amber-400" title={`Melebihi had ${thresholds?.rateLimitEventsAlert}`} />}
            </p>
            <p className={`text-xs font-black mt-1 ${summary.rateLimitBlocks > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {summary.rateLimitBlocks}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stor Google</p>
            <p className="text-xs font-black mt-1 text-emerald-400">{summary.storageStatus}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
