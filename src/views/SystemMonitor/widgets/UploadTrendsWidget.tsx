import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { UploadTrend } from '../../../types/monitoring';

interface UploadTrendsWidgetProps {
  trend: UploadTrend | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isLive: boolean;
}

export function UploadTrendsWidget({ 
  trend, 
  loading, 
  error, 
  onRetry,
  isLive 
}: UploadTrendsWidgetProps) {
  const [trendTab, setTrendTab] = useState<'7days' | '30days'>('7days');

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs h-full flex flex-col hover:shadow-md hover:border-slate-200/60 transition-all duration-300">
      <div className="border-b border-slate-50 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
          <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Aliran Muat Naik Fail</h3>
          {isLive && (
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setTrendTab('7days')}
            className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${
              trendTab === '7days' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            7 Hari
          </button>
          <button
            onClick={() => setTrendTab('30days')}
            className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${
              trendTab === '30days' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            30 Hari
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-[250px] mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="text-xs text-slate-400">Menyusun data trend...</p>
          </div>
        ) : error ? (
          <div className="text-center p-6 text-xs text-rose-500">
            {error}
            <button onClick={onRetry} className="block mx-auto mt-2 text-indigo-600 font-bold hover:underline cursor-pointer">Cuba Semula</button>
          </div>
        ) : trend ? (
          (() => {
            const dataPoints = trendTab === '7days' ? trend.last7Days : trend.last30Days;
            const maxCount = Math.max(...dataPoints.map(d => d.count), 5);

            return (
              <div className="w-full flex flex-col h-full justify-between">
                {/* Custom Rendered SVG / CSS Chart */}
                <div className="flex items-end gap-2.5 sm:gap-4.5 h-44 border-b border-slate-100 px-2 pb-1">
                  {dataPoints.map((dp, idx) => {
                    const percentHeight = (dp.count / maxCount) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-10 whitespace-nowrap shadow-md">
                          {dp.count} fail
                        </div>
                        {/* Bar */}
                        <div 
                          style={{ height: `${percentHeight}%` }} 
                          className="w-full bg-gradient-to-t from-indigo-500 to-sky-400 hover:from-indigo-600 hover:to-sky-500 rounded-t-md transition-all duration-300 min-h-[4px] cursor-pointer"
                        ></div>
                      </div>
                    );
                  })}
                </div>
                
                {/* X-Axis labels */}
                <div className="flex items-center gap-2.5 sm:gap-4.5 px-2 mt-3 overflow-x-auto">
                  {dataPoints.map((dp, idx) => (
                    <div key={idx} className="flex-1 text-center text-[10px] font-bold text-slate-400 truncate">
                      {dp.dateStr}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}
