/**
 * TypeScript definitions for the Enterprise Monitoring & Observability Module.
 */

export const MONITORING_SCHEMA_VERSION = 1;

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'OFFLINE';

export interface HealthComponent {
  name: string;
  status: HealthStatus;
  details: string;
  lastCheckedAt: Date;
  latencyMs?: number;
}

export interface CircuitBreakerInfo {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: Date | null;
  nextRetryTime: Date | null;
  failureThreshold?: number;
  cooldownPeriodMs?: number;
}

export interface SystemHealth {
  googleDrive: HealthComponent;
  firestore: HealthComponent;
  cloudFunctions: HealthComponent;
  auth: HealthComponent;
  circuitBreaker?: CircuitBreakerInfo;
}

export interface TodayStatistics {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  successRate: number; // Percentage, e.g. 98.5
  avgFileSize: number; // in bytes
  avgDuration: string; // e.g. "1.8s" (mock/placeholder as specified)
  activeUsers: number; // count of unique active users today
}

export interface TrendPoint {
  dateStr: string; // e.g., "Mon", "24 Jun"
  count: number;
}

export interface UploadTrend {
  todayCount: number;
  last7Days: TrendPoint[];
  last30Days: TrendPoint[];
}

export interface UnitActivity {
  name: string;
  count: number;
  percentage: number;
}

export interface RecentUploadActivity {
  id: string;
  time: Date;
  user: string;
  unit: string;
  filename: string;
  size: number; // in bytes
  status: string; // 'SUCCESS', 'FAILED', etc.
}

export interface SecurityActivityEvent {
  id: string;
  time: Date;
  event: string; // 'RATE_LIMIT', 'ROLE_CHANGE', etc.
  user: string;
  status: string; // 'BLOCKED', 'SUCCESS', etc.
  requestId: string;
}

export interface Offender {
  email: string;
  count: number;
}

export interface EndpointStat {
  endpoint: string;
  count: number;
}

export interface RateLimitStatistics {
  todayBlocked: number;
  topOffenders: Offender[];
  mostTargetedEndpoint: EndpointStat | null;
}

export interface PipelineItem {
  id: string;
  filename: string;
  unit: string;
  user: string;
  status: 'PENDING' | 'VALIDATED' | 'UPLOADING' | 'AUDITING' | 'SUCCESS' | 'FAILED';
  lastUpdated: Date;
}

export interface ExecutiveSummary {
  health: HealthStatus;
  todayUploads: number;
  failedUploads: number;
  securityEvents: number;
  rateLimitBlocks: number;
  storageStatus: string; // e.g., "Normal", "Near Limit", "Critical"
}

export interface MonitoringThresholds {
  successRateWarning: number; // e.g., 95 (warning if < 95%)
  failedUploadsWarning: number; // e.g., 10 (warning if > 10)
  rateLimitEventsAlert: number; // e.g., 20 (security alert if > 20)
}

export interface MonitoringSettings {
  refreshInterval: number; // in milliseconds, e.g. 30000
  cacheTTL: number; // in seconds, e.g. 30
  liveModeDefault: boolean; // default mode
  maxRecentUploads: number; // limit for recent uploads lists
  healthThresholdMinutes: number; // threshold in minutes to check if Drive is healthy via audits
  thresholds: MonitoringThresholds;
}

export interface MonitoringResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
