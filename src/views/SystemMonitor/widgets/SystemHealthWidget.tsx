import React from 'react';
import { Server, Database, Cloud, Zap, Lock } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { SystemHealth } from '../../../types/monitoring';

interface SystemHealthWidgetProps {
  health: SystemHealth | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isLive: boolean;
}

export function SystemHealthWidget({ 
  health, 
  loading, 
  error, 
  onRetry,
  isLive 
}: SystemHealthWidgetProps) {
  const renderStatusBadge = (status: 'HEALTHY' | 'WARNING' | 'OFFLINE') => {
    if (status === 'HEALTHY') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Normal
        </span>
      );
    }
    if (status === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Amaran
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        Terputus
      </span>
    );
  };

  return (
    <WidgetCard 
      title="Kesihatan Komponen Sistem" 
      icon={<Server className="w-4.5 h-4.5 text-indigo-500" />} 
      loading={loading} 
      error={error} 
      onRetry={onRetry}
      isLive={isLive}
    >
      {health && (
        <div className="space-y-4 w-full">
          {Object.entries(health)
            .filter(([key]) => key !== 'circuitBreaker')
            .map(([key, anyComp]) => {
              const comp = anyComp as any;
              let iconElement = <Database className="w-5 h-5 text-indigo-500" />;
              if (key === 'googleDrive') iconElement = <Cloud className="w-5 h-5 text-sky-500" />;
              if (key === 'cloudFunctions') iconElement = <Zap className="w-5 h-5 text-amber-500 animate-pulse" />;
              if (key === 'auth') iconElement = <Lock className="w-5 h-5 text-rose-500" />;

              return (
                <div key={key} className="p-3 border border-slate-50 hover:bg-slate-50/60 rounded-xl transition-all duration-200 flex items-start gap-3 w-full">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    {iconElement}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-slate-700 truncate">{comp.name}</h4>
                      {renderStatusBadge(comp.status)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">{comp.details}</p>
                    {comp.latencyMs !== undefined && (
                      <div className="text-[10px] font-mono text-slate-400 mt-1">
                        Respons kependaman: <span className="font-bold text-slate-600">{comp.latencyMs}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {health.circuitBreaker && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-850 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  Kawalan Circuit Breaker
                </h4>
                {health.circuitBreaker.state === 'CLOSED' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                    CLOSED (Sihat)
                  </span>
                )}
                {health.circuitBreaker.state === 'HALF_OPEN' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">
                    HALF-OPEN (Menguji)
                  </span>
                )}
                {health.circuitBreaker.state === 'OPEN' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100 animate-bounce">
                    OPEN (Disekat)
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 bg-slate-50/60 border border-slate-100 rounded-lg">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Status Circuit</span>
                  <span className={`font-black ${health.circuitBreaker.state === 'CLOSED' ? 'text-emerald-500' : health.circuitBreaker.state === 'HALF_OPEN' ? 'text-amber-500' : 'text-rose-500'}`}>
                    {health.circuitBreaker.state}
                  </span>
                </div>
                <div className="p-2 bg-slate-50/60 border border-slate-100 rounded-lg">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Kiraan Ralat</span>
                  <span className="font-bold text-slate-700">
                    {health.circuitBreaker.failureCount} / 3
                  </span>
                </div>
                <div className="p-2 bg-slate-50/60 border border-slate-100 rounded-lg col-span-2">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Kegagalan Terakhir</span>
                  <span className="text-slate-600 font-bold">
                    {health.circuitBreaker.lastFailureTime 
                      ? new Date(health.circuitBreaker.lastFailureTime).toLocaleTimeString('ms-MY') 
                      : 'Tiada ralat dikesan'}
                  </span>
                </div>
                {health.circuitBreaker.state === 'OPEN' && (
                  <div className="p-2 bg-rose-50/40 border border-rose-100 rounded-lg col-span-2 animate-pulse">
                    <span className="text-rose-400 block text-[8px] font-bold uppercase tracking-wider">Masa Ujian Pemulihan</span>
                    <span className="text-rose-600 font-black">
                      {health.circuitBreaker.nextRetryTime 
                        ? new Date(health.circuitBreaker.nextRetryTime).toLocaleTimeString('ms-MY') 
                        : 'Segera'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
