import React from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { RateLimitStatistics, MonitoringSettings } from '../../../types/monitoring';

interface RateLimitWidgetProps {
  rateLimit: RateLimitStatistics | null;
  loading: boolean;
  error: string | null;
  settings: MonitoringSettings | null;
  onRetry: () => void;
  isLive: boolean;
}

export function RateLimitWidget({ 
  rateLimit, 
  loading, 
  error, 
  settings, 
  onRetry,
  isLive 
}: RateLimitWidgetProps) {
  const thresholds = settings?.thresholds;
  const isRateLimitHigh = rateLimit && thresholds && rateLimit.todayBlocked > thresholds.rateLimitEventsAlert;

  return (
    <WidgetCard 
      title="Had Kadar &amp; Penyekat Aktiviti" 
      icon={<Shield className="w-4.5 h-4.5 text-indigo-500" />} 
      loading={loading} 
      error={error} 
      onRetry={onRetry}
      isLive={isLive}
    >
      {rateLimit && (
        <div className="space-y-5 w-full">
          <div className={`p-4 rounded-2xl text-center border transition-all ${isRateLimitHigh ? 'bg-rose-50 border-rose-100 text-rose-700 animate-pulse' : 'bg-amber-50/50 border-amber-100 text-amber-700'}`}>
            <p className="text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1">
              Permintaan Disekat Hari Ini
              {isRateLimitHigh && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" title={`Melebihi had amaran ${thresholds?.rateLimitEventsAlert}`} />}
            </p>
            <p className={`text-3xl font-black mt-1 ${isRateLimitHigh ? 'text-rose-600' : 'text-amber-700'}`}>{rateLimit.todayBlocked}</p>
          </div>

          <div className="space-y-2.5 w-full">
            <h4 className="text-xs font-extrabold text-slate-700">Akaun Offender Tertinggi</h4>
            {rateLimit.topOffenders.length === 0 ? (
              <p className="text-[11px] text-slate-400">Tiada penyekatan direkodkan.</p>
            ) : (
              <div className="space-y-2 w-full">
                {rateLimit.topOffenders.map((off, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 border border-slate-50 bg-slate-50/30 rounded-lg w-full">
                    <span className="font-medium text-slate-600 truncate max-w-[85%]" title={off.email}>{off.email}</span>
                    <span className="font-bold text-slate-700 shrink-0">{off.count} sekat</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {rateLimit.mostTargetedEndpoint && (
            <div className="pt-2 border-t border-slate-100 w-full">
              <h4 className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Modul Sasaran Utama</h4>
              <div className="flex items-center justify-between text-xs mt-1.5 p-2 bg-indigo-50/30 border border-indigo-100/40 rounded-lg w-full">
                <span className="font-extrabold text-slate-700 truncate max-w-[70%]" title={rateLimit.mostTargetedEndpoint.endpoint}>
                  {rateLimit.mostTargetedEndpoint.endpoint}
                </span>
                <span className="text-[11px] text-slate-500 shrink-0">{rateLimit.mostTargetedEndpoint.count} akses</span>
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
