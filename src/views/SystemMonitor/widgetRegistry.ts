export interface WidgetDefinition {
  id: string;
  title: string;
  componentName: string;
  defaultColSpan: string; // e.g., 'xl:col-span-6'
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: 'summary', title: 'Ringkasan Eksekutif', componentName: 'ExecutiveSummaryWidget', defaultColSpan: 'col-span-12' },
  { id: 'health', title: 'Kesihatan Komponen Sistem', componentName: 'SystemHealthWidget', defaultColSpan: 'xl:col-span-5 col-span-12' },
  { id: 'kpi', title: 'Prestasi & KPI Hari Ini', componentName: 'TodayKPIsWidget', defaultColSpan: 'xl:col-span-7 col-span-12' },
  { id: 'trend', title: 'Aliran Muat Naik Fail', componentName: 'UploadTrendsWidget', defaultColSpan: 'lg:col-span-8 col-span-12' },
  { id: 'topUnits', title: 'Unit Sektor Paling Aktif', componentName: 'TopActiveUnitsWidget', defaultColSpan: 'lg:col-span-4 col-span-12' },
  { id: 'pipeline', title: 'Status Saluran Muat Naik', componentName: 'UploadPipelineWidget', defaultColSpan: 'xl:col-span-7 col-span-12' },
  { id: 'rateLimit', title: 'Had Kadar & Penyekat', componentName: 'RateLimitWidget', defaultColSpan: 'xl:col-span-5 col-span-12' },
  { id: 'recentUploads', title: 'Log Aktiviti Muat Naik', componentName: 'RecentUploadsWidget', defaultColSpan: 'col-span-12' },
  { id: 'security', title: 'Log Keselamatan', componentName: 'SecurityEventsWidget', defaultColSpan: 'col-span-12' },
  { id: 'releaseManifest', title: 'Urus Tadbir Perlepasan & Manifest Operasi', componentName: 'ReleaseManifestWidget', defaultColSpan: 'col-span-12' },
];
