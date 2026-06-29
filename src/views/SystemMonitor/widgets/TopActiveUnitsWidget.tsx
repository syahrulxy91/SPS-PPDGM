import React from 'react';
import { Users } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { UnitActivity } from '../../../types/monitoring';
import { getUnitDisplayName } from '../../../types';

interface TopActiveUnitsWidgetProps {
  topUnits: UnitActivity[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isLive: boolean;
}

export function TopActiveUnitsWidget({ 
  topUnits, 
  loading, 
  error, 
  onRetry,
  isLive 
}: TopActiveUnitsWidgetProps) {
  return (
    <WidgetCard 
      title="Unit Sektor Paling Aktif" 
      icon={<Users className="w-4.5 h-4.5 text-indigo-500" />} 
      loading={loading} 
      error={error} 
      onRetry={onRetry}
      isLive={isLive}
    >
      {topUnits && topUnits.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6 w-full">Tiada muat naik direkodkan.</p>
      ) : topUnits ? (
        <div className="space-y-4 w-full">
          {topUnits.map((u, idx) => (
            <div key={idx} className="space-y-1.5 w-full">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700 truncate max-w-[70%]" title={getUnitDisplayName(u.name)}>
                  {getUnitDisplayName(u.name)}
                </span>
                <span className="font-mono text-slate-500 shrink-0">
                  {u.count} <span className="text-[10px] text-slate-400 font-normal">({u.percentage}%)</span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${u.percentage}%` }}
                  className="h-full bg-indigo-600 rounded-full"
                ></div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
}
