import React, { useState } from 'react';
import { 
  Activity, 
  Settings, 
  RefreshCw, 
  Radio,
  Sliders,
  Sparkles
} from 'lucide-react';
import { useSystemMonitor } from '../hooks/useSystemMonitor';
import { ExecutiveSummaryWidget } from './SystemMonitor/widgets/ExecutiveSummaryWidget';
import { SystemHealthWidget } from './SystemMonitor/widgets/SystemHealthWidget';
import { TodayKPIsWidget } from './SystemMonitor/widgets/TodayKPIsWidget';
import { UploadTrendsWidget } from './SystemMonitor/widgets/UploadTrendsWidget';
import { TopActiveUnitsWidget } from './SystemMonitor/widgets/TopActiveUnitsWidget';
import { UploadPipelineWidget } from './SystemMonitor/widgets/UploadPipelineWidget';
import { RateLimitWidget } from './SystemMonitor/widgets/RateLimitWidget';
import { RecentUploadsWidget } from './SystemMonitor/widgets/RecentUploadsWidget';
import { SecurityEventsWidget } from './SystemMonitor/widgets/SecurityEventsWidget';
import { MonitoringSettingsWidget } from './SystemMonitor/widgets/MonitoringSettingsWidget';
import { RuntimeConfigWidget } from './SystemMonitor/widgets/RuntimeConfigWidget';
import { ReleaseManifestWidget } from './SystemMonitor/widgets/ReleaseManifestWidget';
import { WIDGET_REGISTRY } from './SystemMonitor/widgetRegistry';

/**
 * SPS PPD Gua Musang Enterprise Monitoring & Observability Module
 * Elite Senior Product UX/UI Layout
 * Supported modes: Manual (Caching enabled) & Live (Firestore onSnapshot subscriptions)
 */

export default function SystemMonitor() {
  const {
    isLive,
    setIsLive,

    settings,
    settingsLoading,
    settingsError,
    saveSettings,
    refetchSettings,

    runtimeConfig,
    runtimeConfigLoading,
    runtimeConfigError,
    refetchRuntimeConfig,

    health,
    healthLoading,
    healthError,
    refetchHealth,

    kpi,
    kpiLoading,
    kpiError,
    refetchKpi,

    trend,
    trendLoading,
    trendError,
    refetchTrend,

    topUnits,
    topUnitsLoading,
    topUnitsError,
    refetchTopUnits,

    recentUploads,
    recentUploadsLoading,
    recentUploadsError,
    refetchRecentUploads,
    loadMoreUploads,
    hasNextUploads,

    securityEvents,
    securityEventsLoading,
    securityEventsError,
    refetchSecurityEvents,

    rateLimit,
    rateLimitLoading,
    rateLimitError,
    refetchRateLimit,

    pipeline,
    pipelineLoading,
    pipelineError,
    refetchPipeline,

    summary,
    summaryLoading,
    summaryError,
    refetchSummary,

    refreshAll
  } = useSystemMonitor();

  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    refreshAll();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  const handleToggleMode = () => {
    setIsLive(prev => !prev);
  };

  return (
    <div id="system-observability-root" className="space-y-8 font-sans pb-12">
      
      {/* Title Header */}
      <div id="monitoring-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">SPS Portal Monitoring</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
            Hab pemerhatian sekuriti, had kadar, analisis muat naik, dan status salur-kerja masa-nyata bagi Sektor Pengurusan Sekolah.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Mode Switcher Selector */}
          <div className="flex items-center bg-slate-100 border border-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setIsLive(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                !isLive 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>Manual</span>
              <span className="text-[9px] text-slate-400 font-mono font-normal">(Cache)</span>
            </button>
            <button
              onClick={() => setIsLive(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                isLive 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Live</span>
              <span className="text-[9px] text-indigo-200 font-mono font-normal">Masa-Nyata</span>
            </button>
          </div>

          <button
            onClick={() => setShowSettings(prev => !prev)}
            className={`flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
              showSettings ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Tetapan</span>
          </button>

          {!isLive && (
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer ${
                isRefreshing && 'opacity-70 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Menyegarkan...' : 'Segarkan Semua'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Settings Section */}
      {showSettings && (
        <div className="transition-all duration-300">
          <MonitoringSettingsWidget
            settings={settings}
            loading={settingsLoading}
            error={settingsError}
            onSave={saveSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {/* Widget Registry Visual Indicator (Senior UX detail) */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono font-medium">
        <Sliders className="w-3.5 h-3.5" />
        <span>Status Storan Model: </span>
        <span className="font-extrabold text-indigo-600">Firestore (onSnapshot &amp; getDocs)</span>
        <span>•</span>
        <span>Versi Skema Observabiliti: </span>
        <span className="font-extrabold text-indigo-600">v1.0.0</span>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Row 1: Executive Summary */}
        <div className="col-span-12">
          <ExecutiveSummaryWidget
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
            settings={settings}
            onRetry={refetchSummary}
            isLive={isLive}
          />
        </div>

        {/* Row 2: Components Health & KPI Dashboard */}
        <div className="col-span-12 xl:col-span-5 space-y-8">
          <SystemHealthWidget
            health={health}
            loading={healthLoading}
            error={healthError}
            onRetry={refetchHealth}
            isLive={isLive}
          />
          <RuntimeConfigWidget
            config={runtimeConfig}
            loading={runtimeConfigLoading}
            error={runtimeConfigError}
            onRetry={refetchRuntimeConfig}
            isLive={isLive}
          />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <TodayKPIsWidget
            kpi={kpi}
            loading={kpiLoading}
            error={kpiError}
            settings={settings}
            onRetry={refetchKpi}
            isLive={isLive}
          />
        </div>

        {/* Row 3: Upload Trends Chart & Top Active Units */}
        <div className="col-span-12 lg:col-span-8">
          <UploadTrendsWidget
            trend={trend}
            loading={trendLoading}
            error={trendError}
            onRetry={refetchTrend}
            isLive={isLive}
          />
        </div>

        <div className="col-span-12 lg:col-span-4">
          <TopActiveUnitsWidget
            topUnits={topUnits}
            loading={topUnitsLoading}
            error={topUnitsError}
            onRetry={refetchTopUnits}
            isLive={isLive}
          />
        </div>

        {/* Row 4: Pipeline Workspace Channel & Rate Limit Block Stats */}
        <div className="col-span-12 xl:col-span-7">
          <UploadPipelineWidget
            pipeline={pipeline}
            loading={pipelineLoading}
            error={pipelineError}
            onRetry={refetchPipeline}
            isLive={isLive}
          />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <RateLimitWidget
            rateLimit={rateLimit}
            loading={rateLimitLoading}
            error={rateLimitError}
            settings={settings}
            onRetry={refetchRateLimit}
            isLive={isLive}
          />
        </div>

        {/* Row 5: Logs (Recent Upload Activity Log & Security Intrusion Alert Log) */}
        <div className="col-span-12">
          <RecentUploadsWidget
            recentUploads={recentUploads}
            loading={recentUploadsLoading}
            error={recentUploadsError}
            onRetry={refetchRecentUploads}
            loadMoreUploads={loadMoreUploads}
            hasNextUploads={hasNextUploads}
            isLive={isLive}
          />
        </div>

        <div className="col-span-12">
          <SecurityEventsWidget
            securityEvents={securityEvents}
            loading={securityEventsLoading}
            error={securityEventsError}
            onRetry={refetchSecurityEvents}
            isLive={isLive}
          />
        </div>

        <div className="col-span-12">
          <ReleaseManifestWidget
            isLive={isLive}
          />
        </div>

      </div>
    </div>
  );
}
