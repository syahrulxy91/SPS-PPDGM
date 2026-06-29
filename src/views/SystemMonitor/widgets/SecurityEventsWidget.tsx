import React from 'react';
import { Shield } from 'lucide-react';
import { SecurityActivityEvent } from '../../../types/monitoring';

interface SecurityEventsWidgetProps {
  securityEvents: SecurityActivityEvent[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isLive: boolean;
}

export function SecurityEventsWidget({ 
  securityEvents, 
  loading, 
  error, 
  onRetry,
  isLive 
}: SecurityEventsWidgetProps) {
  return (
    <div id="security-section" className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-200/60 transition-all duration-300">
      <div className="border-b border-slate-50 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4.5 h-4.5 text-indigo-500" />
          <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Log Keselamatan &amp; Pencerobohan Sistem Terbaru</h3>
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
          Segarkan Keselamatan
        </button>
      </div>

      <div className="overflow-x-auto mt-4 w-full">
        {loading && !securityEvents ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-400">Melayari log keselamatan...</p>
          </div>
        ) : error ? (
          <p className="text-xs text-rose-500 text-center py-6">{error}</p>
        ) : securityEvents && securityEvents.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">Tiada rekod sekuriti ditemui.</div>
        ) : securityEvents ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-3">Masa</th>
                <th className="p-3">Acara Sec</th>
                <th className="p-3">Pengendali / Pengguna</th>
                <th className="p-3">Keputusan</th>
                <th className="p-3 text-right">Request ID</th>
              </tr>
            </thead>
            <tbody>
              {securityEvents.map((ev) => {
                let eventColor = 'bg-slate-100 text-slate-600';
                if (ev.event === 'RATE_LIMIT') eventColor = 'bg-amber-100 text-amber-700 font-mono';
                else if (ev.event === 'ROLE_CHANGE') eventColor = 'bg-pink-100 text-pink-700 font-mono';
                
                let resultColor = 'text-emerald-600 font-bold';
                if (ev.status === 'BLOCKED' || ev.status === 'FAILED') resultColor = 'text-rose-600 font-bold';

                return (
                  <tr key={ev.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-all">
                    <td className="p-3 font-mono text-slate-500 font-medium">
                      {ev.time.toLocaleString('ms-MY')}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black ${eventColor}`}>
                        {ev.event}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-700 truncate max-w-[180px]" title={ev.user}>
                      {ev.user}
                    </td>
                    <td className={`p-3 ${resultColor}`}>
                      {ev.status}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400 font-medium select-all">
                      {ev.requestId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
