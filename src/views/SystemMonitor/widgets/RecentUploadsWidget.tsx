import React from 'react';
import { FileUp, ChevronRight } from 'lucide-react';
import { RecentUploadActivity } from '../../../types/monitoring';
import { getUnitDisplayName } from '../../../types';

interface RecentUploadsWidgetProps {
  recentUploads: RecentUploadActivity[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  loadMoreUploads: () => void;
  hasNextUploads: boolean;
  isLive: boolean;
}

export function RecentUploadsWidget({ 
  recentUploads, 
  loading, 
  error, 
  onRetry,
  loadMoreUploads,
  hasNextUploads,
  isLive 
}: RecentUploadsWidgetProps) {
  // Helper for size formatter
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div id="recent-uploads-section" className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-200/60 transition-all duration-300">
      <div className="border-b border-slate-50 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileUp className="w-4.5 h-4.5 text-indigo-500" />
          <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Log Aktiviti Muat Naik Terbaru</h3>
          {isLive && (
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
          )}
        </div>
        <button 
          onClick={onRetry} 
          className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
        >
          Segarkan Log
        </button>
      </div>

      <div className="overflow-x-auto mt-4 w-full">
        {loading && !recentUploads ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-400">Memuatkan log muat naik...</p>
          </div>
        ) : error ? (
          <p className="text-xs text-rose-500 text-center py-6">{error}</p>
        ) : recentUploads && recentUploads.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">Tiada rekod aktiviti muat naik ditemui.</div>
        ) : recentUploads ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-3">Masa</th>
                <th className="p-3">Pengguna</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Nama Fail</th>
                <th className="p-3">Saiz</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentUploads.map((up) => {
                let badgeColor = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                if (up.status === 'FAILED') badgeColor = 'bg-rose-50 text-rose-600 border border-rose-100';

                return (
                  <tr key={up.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-all">
                    <td className="p-3 font-mono text-slate-500 font-medium">
                      {up.time.toLocaleString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-3 font-bold text-slate-700 truncate max-w-[140px]" title={up.user}>
                      {up.user}
                    </td>
                    <td className="p-3 font-medium text-slate-500">
                      {getUnitDisplayName(up.unit)}
                    </td>
                    <td className="p-3 text-slate-600 font-medium truncate max-w-[200px]" title={up.filename}>
                      {up.filename}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {formatBytes(up.size)}
                    </td>
                    <td className="p-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${badgeColor}`}>
                        {up.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      {hasNextUploads && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMoreUploads}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <span>Muat Lebih Banyak Log</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
