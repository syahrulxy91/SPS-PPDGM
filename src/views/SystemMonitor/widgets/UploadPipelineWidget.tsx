import React from 'react';
import { FileCheck2 } from 'lucide-react';
import { PipelineItem } from '../../../types/monitoring';
import { getUnitDisplayName } from '../../../types';

interface UploadPipelineWidgetProps {
  pipeline: PipelineItem[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isLive: boolean;
}

export function UploadPipelineWidget({ 
  pipeline, 
  loading, 
  error, 
  onRetry,
  isLive 
}: UploadPipelineWidgetProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs h-full flex flex-col hover:shadow-md hover:border-slate-200/60 transition-all duration-300">
      <div className="border-b border-slate-50 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileCheck2 className="w-4.5 h-4.5 text-indigo-500" />
          <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Status Saluran Muat Naik Terkini</h3>
          {isLive && (
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
          )}
        </div>
        <button 
          onClick={onRetry} 
          disabled={loading}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
          title="Segarkan pipeline"
        >
          Segarkan
        </button>
      </div>

      <div className="flex-1 mt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-400">Melayari fail diproses...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-center w-full">
            <p className="text-xs text-rose-500">{error}</p>
            <button onClick={onRetry} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Cuba Semula</button>
          </div>
        ) : pipeline && pipeline.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">Tiada requests muat naik dikesan dalam salur-kerja.</div>
        ) : pipeline ? (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {pipeline.map((item) => {
              let statusColor = 'bg-slate-100 text-slate-600';
              if (item.status === 'SUCCESS') statusColor = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
              else if (item.status === 'FAILED') statusColor = 'bg-rose-50 text-rose-600 border border-rose-100';
              else if (item.status === 'PENDING') statusColor = 'bg-indigo-50 text-indigo-600 border border-indigo-100';
              else statusColor = 'bg-amber-50 text-amber-600 border border-amber-100';

              return (
                <div key={item.id} className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50/55 transition-colors flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-700 truncate" title={item.filename}>
                      {item.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                      <span className="truncate max-w-[120px]">{item.user}</span>
                      <span>•</span>
                      <span>{getUnitDisplayName(item.unit)}</span>
                      <span>•</span>
                      <span>{new Date(item.lastUpdated).toLocaleTimeString('ms-MY')}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shrink-0 ${statusColor}`}>
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
