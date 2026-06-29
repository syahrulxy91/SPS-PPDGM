import { useState, useEffect, useCallback, useRef } from 'react';
import * as monitoringService from '../services/monitoringService';
import { 
  SystemHealth, 
  TodayStatistics, 
  UploadTrend, 
  UnitActivity, 
  RecentUploadActivity, 
  SecurityActivityEvent, 
  RateLimitStatistics, 
  PipelineItem, 
  ExecutiveSummary,
  MonitoringSettings
} from '../types/monitoring';

export function useSystemMonitor() {
  // Live mode configuration
  const [isLive, setIsLive] = useState(false);

  // Monitoring Settings State
  const [settings, setSettings] = useState<MonitoringSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Widget States
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<TodayStatistics | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [trend, setTrend] = useState<UploadTrend | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  const [topUnits, setTopUnits] = useState<UnitActivity[] | null>(null);
  const [topUnitsLoading, setTopUnitsLoading] = useState(true);
  const [topUnitsError, setTopUnitsError] = useState<string | null>(null);

  const [recentUploads, setRecentUploads] = useState<RecentUploadActivity[] | null>(null);
  const [recentUploadsLoading, setRecentUploadsLoading] = useState(true);
  const [recentUploadsError, setRecentUploadsError] = useState<string | null>(null);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [hasNextUploads, setHasNextUploads] = useState(false);

  const [securityEvents, setSecurityEvents] = useState<SecurityActivityEvent[] | null>(null);
  const [securityEventsLoading, setSecurityEventsLoading] = useState(true);
  const [securityEventsError, setSecurityEventsError] = useState<string | null>(null);

  const [rateLimit, setRateLimit] = useState<RateLimitStatistics | null>(null);
  const [rateLimitLoading, setRateLimitLoading] = useState(true);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const [pipeline, setPipeline] = useState<PipelineItem[] | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Runtime Configuration State
  const [runtimeConfig, setRuntimeConfig] = useState<monitoringService.RuntimeConfig | null>(null);
  const [runtimeConfigLoading, setRuntimeConfigLoading] = useState(true);
  const [runtimeConfigError, setRuntimeConfigError] = useState<string | null>(null);

  // References to keep unsubscribe handles for real-time live listeners
  const unsubscribes = useRef<(() => void)[]>([]);

  const clearSubscriptions = useCallback(() => {
    unsubscribes.current.forEach(unsub => {
      try {
        unsub();
      } catch (err) {
        console.error('[USE SYSTEM MONITOR] Failed to unsubscribe:', err);
      }
    });
    unsubscribes.current = [];
  }, []);

  // --- Fetch Settings ---
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    const res = await monitoringService.getMonitoringSettings();
    if (res.success && res.data) {
      setSettings(res.data);
      // Initialize isLive if not set
      setIsLive(res.data.liveModeDefault);
    } else {
      setSettingsError(res.error || 'Gagal memuatkan tetapan observabiliti.');
    }
    setSettingsLoading(false);
  }, []);

  const saveSettings = useCallback(async (newSettings: MonitoringSettings) => {
    const res = await monitoringService.updateMonitoringSettings(newSettings);
    if (res.success) {
      setSettings(newSettings);
      return { success: true };
    }
    return { success: false, error: res.error };
  }, []);

  // --- Manual Fetch Functions (Selective Cache Invalidation supported) ---
  const fetchHealth = useCallback(async (forceBypass = false) => {
    setHealthLoading(true);
    setHealthError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('health');
    }
    const res = await monitoringService.getSystemHealth();
    if (res.success && res.data) {
      setHealth(res.data);
    } else {
      setHealthError(res.error || 'Gagal mengambil status kesihatan sistem.');
    }
    setHealthLoading(false);
  }, []);

  const fetchKpi = useCallback(async (forceBypass = false) => {
    setKpiLoading(true);
    setKpiError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('todayStatistics');
    }
    const res = await monitoringService.getTodayStatistics();
    if (res.success && res.data) {
      setKpi(res.data);
    } else {
      setKpiError(res.error || 'Gagal memuatkan statistik KPI hari ini.');
    }
    setKpiLoading(false);
  }, []);

  const fetchTrend = useCallback(async (forceBypass = false) => {
    setTrendLoading(true);
    setTrendError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('uploadTrend');
    }
    const res = await monitoringService.getUploadTrend();
    if (res.success && res.data) {
      setTrend(res.data);
    } else {
      setTrendError(res.error || 'Gagal mengambil data aliran muat naik.');
    }
    setTrendLoading(false);
  }, []);

  const fetchTopUnits = useCallback(async (forceBypass = false) => {
    setTopUnitsLoading(true);
    setTopUnitsError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('topUnits');
    }
    const res = await monitoringService.getTopUnits();
    if (res.success && res.data) {
      setTopUnits(res.data);
    } else {
      setTopUnitsError(res.error || 'Gagal mengambil data unit aktif.');
    }
    setTopUnitsLoading(false);
  }, []);

  const fetchRecentUploads = useCallback(async (isLoadMore = false, forceBypass = false) => {
    if (!isLoadMore) {
      setRecentUploadsLoading(true);
      setRecentUploadsError(null);
    }
    if (forceBypass) {
      monitoringService.invalidateCacheKey('recentUploads');
    }
    const limitCount = settings?.maxRecentUploads || 10;
    const res = await monitoringService.getRecentUploads(
      limitCount, 
      isLoadMore ? lastVisibleDoc : null
    );
    if (res.success && res.data) {
      if (isLoadMore) {
        setRecentUploads(prev => prev ? [...prev, ...res.data.data] : res.data.data);
      } else {
        setRecentUploads(res.data.data);
      }
      setLastVisibleDoc(res.data.lastDoc);
      setHasNextUploads(res.data.hasNext);
    } else {
      setRecentUploadsError(res.error || 'Gagal memuatkan log aktiviti muat naik.');
    }
    setRecentUploadsLoading(false);
  }, [lastVisibleDoc, settings?.maxRecentUploads]);

  const fetchSecurityEvents = useCallback(async (forceBypass = false) => {
    setSecurityEventsLoading(true);
    setSecurityEventsError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('securityEvents');
    }
    const res = await monitoringService.getSecurityEvents();
    if (res.success && res.data) {
      setSecurityEvents(res.data);
    } else {
      setSecurityEventsError(res.error || 'Gagal memuatkan log aktiviti keselamatan.');
    }
    setSecurityEventsLoading(false);
  }, []);

  const fetchRateLimit = useCallback(async (forceBypass = false) => {
    setRateLimitLoading(true);
    setRateLimitError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('rateLimitStatistics');
    }
    const res = await monitoringService.getRateLimitStatistics();
    if (res.success && res.data) {
      setRateLimit(res.data);
    } else {
      setRateLimitError(res.error || 'Gagal memuatkan statistik pengehad kadar.');
    }
    setRateLimitLoading(false);
  }, []);

  const fetchPipeline = useCallback(async (forceBypass = false) => {
    setPipelineLoading(true);
    setPipelineError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('uploadPipeline');
    }
    const res = await monitoringService.getUploadPipeline();
    if (res.success && res.data) {
      setPipeline(res.data);
    } else {
      setPipelineError(res.error || 'Gagal memuatkan status saluran muat naik.');
    }
    setPipelineLoading(false);
  }, []);

  const fetchSummary = useCallback(async (forceBypass = false) => {
    setSummaryLoading(true);
    setSummaryError(null);
    if (forceBypass) {
      monitoringService.invalidateCacheKey('executiveSummary');
      monitoringService.invalidateCacheKey('health');
      monitoringService.invalidateCacheKey('todayStatistics');
      monitoringService.invalidateCacheKey('securityEvents');
      monitoringService.invalidateCacheKey('rateLimitStatistics');
    }
    const res = await monitoringService.getExecutiveSummary();
    if (res.success && res.data) {
      setSummary(res.data);
    } else {
      setSummaryError(res.error || 'Gagal memuatkan ringkasan eksekutif.');
    }
    setSummaryLoading(false);
  }, []);

  const fetchRuntimeConfig = useCallback(async () => {
    setRuntimeConfigLoading(true);
    setRuntimeConfigError(null);
    const res = await monitoringService.getRuntimeConfig();
    if (res.success && res.data) {
      setRuntimeConfig(res.data);
    } else {
      setRuntimeConfigError(res.error || 'Gagal memuatkan konfigurasi runtime.');
    }
    setRuntimeConfigLoading(false);
  }, []);

  const refreshAllManual = useCallback(() => {
    monitoringService.clearMonitoringCache();
    fetchHealth(true);
    fetchKpi(true);
    fetchTrend(true);
    fetchTopUnits(true);
    fetchRecentUploads(false, true);
    fetchSecurityEvents(true);
    fetchRateLimit(true);
    fetchPipeline(true);
    fetchSummary(true);
    fetchRuntimeConfig();
  }, [
    fetchHealth,
    fetchKpi,
    fetchTrend,
    fetchTopUnits,
    fetchRecentUploads,
    fetchSecurityEvents,
    fetchRateLimit,
    fetchPipeline,
    fetchSummary,
    fetchRuntimeConfig
  ]);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle data fetching strategy (Manual vs Live subscriptions)
  useEffect(() => {
    if (settingsLoading) return;

    if (isLive) {
      console.log('[USE SYSTEM MONITOR] Activating Live Mode Subscriptions...');
      clearSubscriptions();

      // 1. Subscribe to System Health
      const unsubHealth = monitoringService.subscribeSystemHealth((res) => {
        if (res.success && res.data) {
          setHealth(res.data);
          setHealthError(null);
        } else {
          setHealthError(res.error || 'Ralat masa-nyata mengambil status kesihatan.');
        }
        setHealthLoading(false);
      });
      unsubscribes.current.push(unsubHealth);

      // 2. Subscribe to Today Statistics
      const unsubKpi = monitoringService.subscribeTodayStatistics((res) => {
        if (res.success && res.data) {
          setKpi(res.data);
          setKpiError(null);
        } else {
          setKpiError(res.error || 'Ralat masa-nyata mengambil statistik KPI.');
        }
        setKpiLoading(false);
      });
      unsubscribes.current.push(unsubKpi);

      // 3. Subscribe to Trend
      const unsubTrend = monitoringService.subscribeUploadTrend((res) => {
        if (res.success && res.data) {
          setTrend(res.data);
          setTrendError(null);
        } else {
          setTrendError(res.error || 'Ralat masa-nyata mengambil aliran muat naik.');
        }
        setTrendLoading(false);
      });
      unsubscribes.current.push(unsubTrend);

      // 4. Subscribe to Top Units
      const unsubTopUnits = monitoringService.subscribeTopUnits((res) => {
        if (res.success && res.data) {
          setTopUnits(res.data);
          setTopUnitsError(null);
        } else {
          setTopUnitsError(res.error || 'Ralat masa-nyata mengambil unit aktif.');
        }
        setTopUnitsLoading(false);
      });
      unsubscribes.current.push(unsubTopUnits);

      // 5. Subscribe to Recent Uploads
      const limitCount = settings?.maxRecentUploads || 10;
      const unsubRecent = monitoringService.subscribeRecentUploads(limitCount, (res) => {
        if (res.success && res.data) {
          setRecentUploads(res.data.data);
          setHasNextUploads(res.data.hasNext);
          setRecentUploadsError(null);
        } else {
          setRecentUploadsError(res.error || 'Ralat masa-nyata mengambil log muat naik.');
        }
        setRecentUploadsLoading(false);
      });
      unsubscribes.current.push(unsubRecent);

      // 6. Subscribe to Security Events
      const unsubSec = monitoringService.subscribeSecurityEvents(15, (res) => {
        if (res.success && res.data) {
          setSecurityEvents(res.data);
          setSecurityEventsError(null);
        } else {
          setSecurityEventsError(res.error || 'Ralat masa-nyata mengambil log keselamatan.');
        }
        setSecurityEventsLoading(false);
      });
      unsubscribes.current.push(unsubSec);

      // 7. Subscribe to Rate Limit Statistics
      const unsubRate = monitoringService.subscribeRateLimitStatistics((res) => {
        if (res.success && res.data) {
          setRateLimit(res.data);
          setRateLimitError(null);
        } else {
          setRateLimitError(res.error || 'Ralat masa-nyata mengambil statistik had kadar.');
        }
        setRateLimitLoading(false);
      });
      unsubscribes.current.push(unsubRate);

      // 8. Subscribe to Upload Pipeline
      const unsubPipe = monitoringService.subscribeUploadPipeline((res) => {
        if (res.success && res.data) {
          setPipeline(res.data);
          setPipelineError(null);
        } else {
          setPipelineError(res.error || 'Ralat masa-nyata mengambil status saluran.');
        }
        setPipelineLoading(false);
      });
      unsubscribes.current.push(unsubPipe);

      // 9. Subscribe to Executive Summary
      const unsubSummary = monitoringService.subscribeExecutiveSummary((res) => {
        if (res.success && res.data) {
          setSummary(res.data);
          setSummaryError(null);
        } else {
          setSummaryError(res.error || 'Ralat masa-nyata mengambil ringkasan eksekutif.');
        }
        setSummaryLoading(false);
      });
      unsubscribes.current.push(unsubSummary);

      // 10. Subscribe to Runtime Configuration
      const unsubRuntime = monitoringService.subscribeRuntimeConfig((res) => {
        if (res.success && res.data) {
          setRuntimeConfig(res.data);
          setRuntimeConfigError(null);
        } else {
          setRuntimeConfigError(res.error || 'Ralat masa-nyata mengambil konfigurasi runtime.');
        }
        setRuntimeConfigLoading(false);
      });
      unsubscribes.current.push(unsubRuntime);

    } else {
      console.log('[USE SYSTEM MONITOR] Activating Manual Mode (Cached Fetch)...');
      clearSubscriptions();

      // Trigger standard loads
      fetchHealth(false);
      fetchKpi(false);
      fetchTrend(false);
      fetchTopUnits(false);
      fetchRecentUploads(false, false);
      fetchSecurityEvents(false);
      fetchRateLimit(false);
      fetchPipeline(false);
      fetchSummary(false);
      fetchRuntimeConfig();

      // Setup polling interval for manual mode as specified in Settings
      const intervalMs = settings?.refreshInterval || 30000;
      const intervalId = setInterval(() => {
        console.log('[USE SYSTEM MONITOR] Polling dashboard updates...');
        fetchHealth(false);
        fetchKpi(false);
        fetchTrend(false);
        fetchTopUnits(false);
        fetchRecentUploads(false, false);
        fetchSecurityEvents(false);
        fetchRateLimit(false);
        fetchPipeline(false);
        fetchSummary(false);
        fetchRuntimeConfig();
      }, intervalMs);

      return () => {
        clearInterval(intervalId);
      };
    }

    return () => {
      clearSubscriptions();
    };
  }, [
    isLive, 
    settingsLoading, 
    settings?.refreshInterval, 
    settings?.maxRecentUploads,
    clearSubscriptions,
    fetchHealth,
    fetchKpi,
    fetchTrend,
    fetchTopUnits,
    fetchRecentUploads,
    fetchSecurityEvents,
    fetchRateLimit,
    fetchPipeline,
    fetchSummary,
    fetchRuntimeConfig
  ]);

  return {
    isLive,
    setIsLive,

    settings,
    settingsLoading,
    settingsError,
    saveSettings,
    refetchSettings: fetchSettings,

    runtimeConfig,
    runtimeConfigLoading,
    runtimeConfigError,
    refetchRuntimeConfig: fetchRuntimeConfig,

    health,
    healthLoading,
    healthError,
    refetchHealth: () => fetchHealth(true),

    kpi,
    kpiLoading,
    kpiError,
    refetchKpi: () => fetchKpi(true),

    trend,
    trendLoading,
    trendError,
    refetchTrend: () => fetchTrend(true),

    topUnits,
    topUnitsLoading,
    topUnitsError,
    refetchTopUnits: () => fetchTopUnits(true),

    recentUploads,
    recentUploadsLoading,
    recentUploadsError,
    refetchRecentUploads: () => fetchRecentUploads(false, true),
    loadMoreUploads: () => fetchRecentUploads(true, false),
    hasNextUploads,

    securityEvents,
    securityEventsLoading,
    securityEventsError,
    refetchSecurityEvents: () => fetchSecurityEvents(true),

    rateLimit,
    rateLimitLoading,
    rateLimitError,
    refetchRateLimit: () => fetchRateLimit(true),

    pipeline,
    pipelineLoading,
    pipelineError,
    refetchPipeline: () => fetchPipeline(true),

    summary,
    summaryLoading,
    summaryError,
    refetchSummary: () => fetchSummary(true),

    refreshAll: refreshAllManual
  };
}
