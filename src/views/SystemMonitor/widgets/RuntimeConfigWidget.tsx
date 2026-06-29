import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, XCircle, ShieldAlert, FileText, Activity, Zap, Timer, RefreshCw } from 'lucide-react';
import { WidgetCard } from './WidgetCard';

export interface RuntimeConfig {
  maintenanceMode: boolean;
  readOnlyMode: boolean;
  enableMonitoring: boolean;
  enableMetrics: boolean;
  enableAudit: boolean;
  enableCircuitBreaker: boolean;
  enableRequestTiming: boolean;
  
  // Enterprise Governance attributes (Sprint B2)
  version?: number;
  source?: string;
  cacheStatus?: string;
  cacheAge?: number;
  lastRefresh?: string;
  lastUpdated?: string;
  updatedBy?: string;
  validationStatus?: string;

  // Enterprise Telemetry attributes (Sprint B2.1)
  cacheHits?: number;
  cacheMisses?: number;
  refreshCount?: number;
  fallbackCount?: number;
  validationWarningCount?: number;
  configDrift?: boolean;
  driftDetails?: any;
  lastRefreshDuration?: number;
  lastRefreshReason?: string;
}

interface RuntimeConfigWidgetProps {
  config: RuntimeConfig | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isLive: boolean;
}

export function RuntimeConfigWidget({
  config,
  loading,
  error,
  onRetry,
  isLive
}: RuntimeConfigWidgetProps) {
  // Local state to keep track of real-time client-side cache age increments
  const [localAge, setLocalAge] = useState<number>(0);

  useEffect(() => {
    if (config) {
      setLocalAge(config.cacheAge ?? 0);
    }
  }, [config]);

  // Increment local cache age every second if live to simulate real-time cache behavior
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (config && isLive) {
      interval = setInterval(() => {
        setLocalAge(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [config, isLive]);

  const renderFlagStatus = (enabled: boolean) => {
    if (enabled) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Aktif
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-150 dark:border-slate-800">
        <XCircle className="w-3.5 h-3.5 text-slate-350 dark:text-slate-600" />
        Nyahaktif
      </span>
    );
  };

  const renderModeBadge = (active: boolean, modeName: string) => {
    if (active) {
      return (
        <div className="flex items-center justify-between p-3.5 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl shadow-xs transition-all duration-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            <span className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wide">{modeName}</span>
          </div>
          <span className="text-[9px] font-black text-white bg-rose-600 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse shadow-xs">
            AKTIF (Sekat)
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between p-3.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{modeName}</span>
        </div>
        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-850 px-2.5 py-1 rounded-full uppercase tracking-wider">
          TIADA SEKATAN
        </span>
      </div>
    );
  };

  return (
    <WidgetCard
      title="Urus Tadbir Konfigurasi Runtime"
      icon={<Cpu className="w-4.5 h-4.5 text-indigo-500" />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      isLive={isLive}
    >
      {config && (
        <div className="space-y-5 w-full">
          {/* Top banner highlighting runtime controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderModeBadge(config.maintenanceMode, 'Mod Penyelenggaraan')}
            {renderModeBadge(config.readOnlyMode, 'Mod Baca Sahaja')}
          </div>

          {/* Configuration Governance Metadata (Section 7 Monitoring) */}
          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              Governance Metadata Layer
            </h4>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Runtime Version</span>
                <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                  v{config.version ?? 1}
                </span>
              </div>
              
              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Config Source</span>
                <span className="font-sans font-bold text-xs text-slate-700 dark:text-slate-300">
                  {config.source || 'FIRESTORE'}
                </span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Cache Status</span>
                <span className="font-sans font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${config.cacheStatus === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`}></span>
                  {config.cacheStatus || 'HIT'}
                </span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Cache Age</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" style={{ animationDuration: '4s' }} />
                  {localAge}s
                </span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Last Sync</span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                  {config.lastRefresh ? new Date(config.lastRefresh).toLocaleTimeString() : 'N/A'}
                </span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Validation Status</span>
                <span className={`inline-flex items-center font-sans font-bold text-[10px] px-2 py-0.5 rounded-full ${
                  config.validationStatus === 'VALID' 
                    ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20' 
                    : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20'
                }`}>
                  {config.validationStatus || 'VALID'}
                </span>
              </div>

              <div className="col-span-2 p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Last Modified By</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold block truncate text-xs">{config.updatedBy || 'SYSTEM'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Modification Date</span>
                  <span className="text-slate-500 dark:text-slate-400 block truncate text-xs">
                    {config.lastUpdated ? new Date(config.lastUpdated).toLocaleDateString() + ' ' + new Date(config.lastUpdated).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Enterprise Telemetry Section (Section 7 Monitoring) */}
          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              Metrik Telemetri Cache & Hardening
            </h4>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Hit / Miss Rate</span>
                <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 block truncate">
                  {config.cacheHits !== undefined && config.cacheMisses !== undefined && (config.cacheHits + config.cacheMisses) > 0
                    ? `${Math.round((config.cacheHits / (config.cacheHits + config.cacheMisses)) * 100)}% / ${Math.round((config.cacheMisses / (config.cacheHits + config.cacheMisses)) * 100)}%`
                    : '100% / 0%'}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5 truncate">Hits: {config.cacheHits ?? 0} | Miss: {config.cacheMisses ?? 0}</span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Penyegaran / Failover</span>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 block truncate">
                  Segar: {config.refreshCount ?? 0} | Gagal: {config.fallbackCount ?? 0}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5 truncate">Reason: {config.lastRefreshReason || 'N/A'}</span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Durasi Penyegaran</span>
                <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 block">
                  {config.lastRefreshDuration !== undefined ? `${config.lastRefreshDuration} ms` : '0 ms'}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5">Read latency</span>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-200">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider">Hanyutan & Amaran</span>
                <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-black block truncate ${
                  config.configDrift ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  Drift: {config.configDrift ? 'DIPILIH' : 'TIADA'}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5 truncate">Amaran: {config.validationWarningCount ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Feature Flags Status Section */}
          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Status Bendera Ciri (Feature Flags)
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border border-slate-50 hover:bg-slate-50/50 dark:border-slate-850 dark:hover:bg-slate-900/30 rounded-xl transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Sistem Monitoring</span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">enableMonitoring</span>
                  </div>
                </div>
                {renderFlagStatus(config.enableMonitoring)}
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-50 hover:bg-slate-50/50 dark:border-slate-850 dark:hover:bg-slate-900/30 rounded-xl transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Pengiraan Metrik</span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">enableMetrics</span>
                  </div>
                </div>
                {renderFlagStatus(config.enableMetrics)}
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-50 hover:bg-slate-50/50 dark:border-slate-850 dark:hover:bg-slate-900/30 rounded-xl transition-all duration-200">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Audit Log Storan</span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">enableAudit</span>
                  </div>
                </div>
                {renderFlagStatus(config.enableAudit)}
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-50 hover:bg-slate-50/50 dark:border-slate-850 dark:hover:bg-slate-900/30 rounded-xl transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-rose-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Enjin Circuit Breaker</span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">enableCircuitBreaker</span>
                  </div>
                </div>
                {renderFlagStatus(config.enableCircuitBreaker)}
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-50 hover:bg-slate-50/50 dark:border-slate-850 dark:hover:bg-slate-900/30 rounded-xl transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Timer className="w-4 h-4 text-sky-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Pengiraan Masa Permintaan</span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">enableRequestTiming</span>
                  </div>
                </div>
                {renderFlagStatus(config.enableRequestTiming)}
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
