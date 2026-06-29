import React from 'react';
import { FileUp, AlertTriangle } from 'lucide-react';
import { TodayStatistics, MonitoringSettings } from '../../../types/monitoring';

interface TodayKPIsWidgetProps {
  kpi: TodayStatistics | null;
  loading: boolean;
  error: string | null;
  settings: MonitoringSettings | null;
  onRetry: () => void;
  isLive: boolean;
}

export function TodayKPIsWidget({ 
  kpi, 
  loading, 
  error, 
  settings, 
  onRetry,
  isLive 
}: TodayKPIsWidgetProps) {
  // Helper for size formatter
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const thresholds = settings?.thresholds;
  const isSuccessRateLow = kpi && thresholds && kpi.successRate < thresholds.successRateWarning;
  const isFailedUploadsHigh = kpi && thresholds && kpi.failedUploads > thresholds.failedUploadsWarning;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs h-full flex flex-col hover:shadow-md hover:border-slate-200/60 transition-all duration-300">
      <div className="border-b border-slate-50 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileUp className="w-4.5 h-4.5 text-indigo-500" />
          <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Prestasi &amp; KPI Hari Ini</h3>
          {isLive && (
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
          )}
        </div>
        <button 
          onClick={onRetry} 
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
          title="Segarkan KPI sahaja"
        >
          Segarkan
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 mt-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="border border-slate-50 rounded-xl p-4 animate-pulse space-y-2 bg-slate-50/40">
              <div className="h-2 bg-slate-200 rounded w-1/2"></div>
              <div className="h-6 bg-slate-200 rounded w-3/4"></div>
            </div>
          ))
        ) : error ? (
          <div className="col-span-full flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xs text-rose-500">{error}</p>
            <button onClick={onRetry} className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer">Cuba Semula</button>
          </div>
        ) : kpi ? (
          <>
            <div className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50/40 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Jumlah Muat Naik</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-black text-slate-800">{kpi.totalUploads}</p>
                <span className="text-[10px] text-slate-400 font-mono">rekod</span>
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50/40 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Muat Naik Berjaya</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-black text-emerald-600">{kpi.successfulUploads}</p>
                <span className="text-[10px] text-emerald-500 font-bold">✓</span>
              </div>
            </div>

            <div className={`border rounded-xl p-4 hover:bg-slate-50/40 transition-all ${isFailedUploadsHigh ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-100'}`}>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                Muat Naik Gagal
                {isFailedUploadsHigh && <AlertTriangle className="w-3 h-3 text-rose-500" title={`Melebihi had ${thresholds?.failedUploadsWarning}`} />}
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-2xl font-black ${kpi.failedUploads > 0 ? (isFailedUploadsHigh ? 'text-rose-600 animate-pulse' : 'text-amber-600') : 'text-slate-800'}`}>
                  {kpi.failedUploads}
                </p>
                <span className="text-[10px] text-slate-400 font-mono">rekod</span>
              </div>
            </div>

            <div className={`border rounded-xl p-4 hover:bg-slate-50/40 transition-all ${isSuccessRateLow ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-100'}`}>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                Kadar Kejayaan
                {isSuccessRateLow && <AlertTriangle className="w-3 h-3 text-rose-500" title={`Di bawah SLA ${thresholds?.successRateWarning}%`} />}
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-2xl font-black ${isSuccessRateLow ? 'text-rose-600' : 'text-indigo-600'}`}>{kpi.successRate}%</p>
                <span className="text-[10px] text-indigo-500 font-bold">SLA</span>
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50/40 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Purata Saiz Fail</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-lg font-black text-slate-800">{formatBytes(kpi.avgFileSize)}</p>
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50/40 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pengguna Aktif Hari Ini</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-black text-slate-800">{kpi.activeUsers}</p>
                <span className="text-[10px] text-slate-400 font-mono">akaun</span>
              </div>
            </div>
          </>
        ) : null}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Masa Pemprosesan Purata: {kpi?.avgDuration || '0.0s'}</span>
        <span>KPI Sasaran: &gt;{thresholds?.successRateWarning}%</span>
      </div>
    </div>
  );
}
