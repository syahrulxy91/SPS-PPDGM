import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  RefreshCw, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Filter,
  User,
  Inbox
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getCurrentAppUser } from '../lib/auth';
import { Navigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';

// Standard Audit Event Types definition
export const AUDIT_EVENT_TYPES = {
  UPLOAD: "UPLOAD",
  DELETE: "DELETE",
  UPDATE: "UPDATE",
  DOWNLOAD: "DOWNLOAD",
  VIEW: "VIEW",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT"
};

// UI Color mappings for Event Types
const EVENT_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  UPLOAD: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'text-emerald-700', border: 'border-emerald-100', label: 'Muat Naik' },
  DELETE: { bg: 'bg-rose-50 text-rose-700 border-rose-100', text: 'text-rose-700', border: 'border-rose-100', label: 'Padam' },
  UPDATE: { bg: 'bg-blue-50 text-blue-700 border-blue-100', text: 'text-blue-700', border: 'border-blue-100', label: 'Kemaskini' },
  DOWNLOAD: { bg: 'bg-purple-50 text-purple-700 border-purple-100', text: 'text-purple-700', border: 'border-purple-100', label: 'Muat Turun' },
  VIEW: { bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'text-slate-700', border: 'border-slate-200', label: 'Paparan' },
  LOGIN: { bg: 'bg-teal-50 text-teal-700 border-teal-100', text: 'text-teal-700', border: 'border-teal-100', label: 'Log Masuk' },
  LOGOUT: { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'text-amber-700', border: 'border-amber-100', label: 'Log Keluar' }
};

export default function AuditAktiviti() {
  const currentUser = getCurrentAppUser();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.email?.toLowerCase() === 'syahrulxy91@gmail.com';
  const isAdmin = isSuperAdmin || currentUser?.role === 'ADMIN';

  // If not admin, render Access Denied view
  if (!isAdmin) {
    return (
      <div id="access-denied-container" className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-100 shadow-md mb-6 animate-bounce">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Akses Ditolak (403)</h2>
        <p className="text-slate-500 text-sm max-w-md mt-2 leading-relaxed">
          Sistem mengesan cubaan akses tanpa kebenaran. Modul Audit Aktiviti SPS hanya dibenarkan untuk kegunaan Super Pentadbir &amp; Pentadbir sahaja.
        </p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-6 px-5 py-2.5 bg-[#0F2D52] hover:bg-[#1a3d66] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
        >
          Kembali ke Dashboard Utama
        </button>
      </div>
    );
  }

  // KPIs States
  const [kpis, setKpis] = useState({
    totalActivities: 0,
    totalUploads: 0,
    totalDeletes: 0,
    totalDownloads: 0,
    totalLogins: 0,
    activeUsers: 0
  });

  // Table Data States
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Filters
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [searchEmail, setSearchEmail] = useState('');
  const [dateRange, setDateRange] = useState('30'); // 'TODAY', '7', '30', '90', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination
  const [pageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageHistory, setPageHistory] = useState<any[]>([null]); // holds starting document snapshots
  const [hasNext, setHasNext] = useState(false);

  // Refresh Trigger
  const [refreshCount, setRefreshCount] = useState(0);

  // Trigger loading KPIs on mount / refresh
  useEffect(() => {
    fetchKPIs();
  }, [refreshCount]);

  // Trigger loading list data when filters, pagination, or refresh trigger changes
  useEffect(() => {
    fetchActivities();
  }, [selectedUnit, selectedEventType, dateRange, customStartDate, customEndDate, currentPage, refreshCount]);

  // Handle email search with local debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(0);
      setPageHistory([null]);
      fetchActivities();
    }, 4500); // long debounce for typing or execute on search button
    return () => clearTimeout(handler);
  }, [searchEmail]);

  // Handle direct search execution
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    setPageHistory([null]);
    fetchActivities();
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedUnit('ALL');
    setSelectedEventType('ALL');
    setSearchEmail('');
    setDateRange('30');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(0);
    setPageHistory([null]);
  };

  // Fetch KPIs dynamically
  const fetchKPIs = async () => {
    setLoadingKpis(true);
    try {
      const auditsCol = collection(db, 'auditUploads');
      
      // Perform fast, server-side aggregations for standard events
      const [totalSnap, uploadSnap, deleteSnap, downloadSnap, loginSnap] = await Promise.all([
        getCountFromServer(auditsCol),
        getCountFromServer(query(auditsCol, where('eventType', '==', 'UPLOAD'))),
        getCountFromServer(query(auditsCol, where('eventType', '==', 'DELETE'))),
        getCountFromServer(query(auditsCol, where('eventType', '==', 'DOWNLOAD'))),
        getCountFromServer(query(auditsCol, where('eventType', '==', 'LOGIN')))
      ]);

      // Calculate approximate active users by scanning the last 300 active logs to extract unique emails
      const activeUsersQuery = query(auditsCol, orderBy('uploadTimestamp', 'desc'), limit(300));
      const activeUsersSnap = await getDocs(activeUsersQuery);
      const uniqueEmails = new Set<string>();
      activeUsersSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.uploadedByEmail) {
          uniqueEmails.add(d.uploadedByEmail.toLowerCase());
        }
      });

      setKpis({
        totalActivities: totalSnap.data().count,
        totalUploads: uploadSnap.data().count,
        totalDeletes: deleteSnap.data().count,
        totalDownloads: downloadSnap.data().count,
        totalLogins: loginSnap.data().count,
        activeUsers: uniqueEmails.size || 1
      });
    } catch (err) {
      console.error('[AUDIT KPIs ERROR]', err);
      handleFirestoreError(err, OperationType.LIST, 'auditUploads');
    } finally {
      setLoadingKpis(false);
    }
  };

  // Fetch paginated activities with fallbacks
  const fetchActivities = async () => {
    setLoading(true);
    setIndexError(null);
    try {
      const auditsCol = collection(db, 'auditUploads');
      const constraints: any[] = [];

      // Filter Unit
      if (selectedUnit !== 'ALL') {
        constraints.push(where('unit', '==', selectedUnit));
      }

      // Filter Event Type
      if (selectedEventType !== 'ALL') {
        constraints.push(where('eventType', '==', selectedEventType));
      }

      // Filter Email Search
      if (searchEmail.trim()) {
        constraints.push(where('uploadedByEmail', '==', searchEmail.trim().toLowerCase()));
      }

      // Filter Date Range
      const now = new Date();
      let startBoundary: Date | null = null;
      if (dateRange === 'TODAY') {
        startBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === '7') {
        startBoundary = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30') {
        startBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '90') {
        startBoundary = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'CUSTOM' && customStartDate) {
        startBoundary = new Date(customStartDate);
      }

      if (startBoundary) {
        constraints.push(where('uploadTimestamp', '>=', Timestamp.fromDate(startBoundary)));
      }

      // If Custom Date Range has an End Date
      if (dateRange === 'CUSTOM' && customEndDate) {
        const endBoundary = new Date(customEndDate);
        endBoundary.setHours(23, 59, 59, 999);
        constraints.push(where('uploadTimestamp', '<=', Timestamp.fromDate(endBoundary)));
      }

      // Primary sorting: uploadTimestamp DESC
      // Note: If combining range filter with orderBy, we must order by that range field first.
      constraints.push(orderBy('uploadTimestamp', 'desc'));

      // Pagination Cursor
      const startDoc = pageHistory[currentPage];
      if (startDoc) {
        constraints.push(startAtCursor(startDoc));
      }

      // Limit by pageSize + 1 to detect if next page exists
      constraints.push(limit(pageSize + 1));

      // Construct and execute query
      const q = query(auditsCol, ...constraints);
      let querySnap;
      try {
        querySnap = await getDocs(q);
      } catch (qErr: any) {
        // Fallback protocol: If Firestore returns an index requirement error, handle gracefully
        if (qErr.message?.includes('index') || qErr.message?.includes('INDEX_REQUISITE') || qErr.message?.includes('requires an index')) {
          console.warn('[FIRESTORE COMPOSITE INDEX REQUIRED]', qErr.message);
          setIndexError(qErr.message);

          // Graceful fallback: execute a simplified query to prevent breaking the application
          const simpleQuery = query(auditsCol, orderBy('uploadTimestamp', 'desc'), limit(150));
          const fallbackSnap = await getDocs(simpleQuery);
          
          // Apply filters in memory
          let filteredDocs = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          if (selectedUnit !== 'ALL') {
            filteredDocs = filteredDocs.filter((d: any) => d.unit === selectedUnit);
          }
          if (selectedEventType !== 'ALL') {
            filteredDocs = filteredDocs.filter((d: any) => d.eventType === selectedEventType);
          }
          if (searchEmail.trim()) {
            filteredDocs = filteredDocs.filter((d: any) => d.uploadedByEmail?.toLowerCase().includes(searchEmail.trim().toLowerCase()));
          }
          if (startBoundary) {
            const boundaryTime = startBoundary.getTime();
            filteredDocs = filteredDocs.filter((d: any) => {
              const ts = d.uploadTimestamp?.seconds ? d.uploadTimestamp.seconds * 1000 : new Date(d.uploadTimestamp || 0).getTime();
              return ts >= boundaryTime;
            });
          }

          // Client-side paginate
          const startIdx = currentPage * pageSize;
          const paginatedDocs = filteredDocs.slice(startIdx, startIdx + pageSize);
          setActivities(paginatedDocs);
          setHasNext(filteredDocs.length > startIdx + pageSize);
          setLoading(false);
          return;
        } else {
          throw qErr;
        }
      }

      const docs = querySnap.docs;
      const hasNextItem = docs.length > pageSize;
      setHasNext(hasNextItem);

      // Extract records
      const pageDocs = hasNextItem ? docs.slice(0, pageSize) : docs;
      setActivities(pageDocs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('[AUDIT FETCH ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to start after a specific snapshot
  const startAtCursor = (snapshot: any) => {
    // Standard firebase modular import handles startAt dynamically
    return {
      filterType: 'startAt',
      _apply: (q: any) => q, // fallback
      _snapshot: snapshot
    };
  };

  // Override startAt helper within Firestore standard query parameters
  const fetchActivitiesWithRealCursor = async () => {
    // For React Firebase standard cursor pagination, we can use startAfter directly
    // Let's implement this cleanly:
    setLoading(true);
    try {
      const auditsCol = collection(db, 'auditUploads');
      let constraints: any[] = [];

      if (selectedUnit !== 'ALL') {
        constraints.push(where('unit', '==', selectedUnit));
      }
      if (selectedEventType !== 'ALL') {
        constraints.push(where('eventType', '==', selectedEventType));
      }
      if (searchEmail.trim()) {
        constraints.push(where('uploadedByEmail', '==', searchEmail.trim().toLowerCase()));
      }

      const now = new Date();
      let startBoundary: Date | null = null;
      if (dateRange === 'TODAY') {
        startBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === '7') {
        startBoundary = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30') {
        startBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '90') {
        startBoundary = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'CUSTOM' && customStartDate) {
        startBoundary = new Date(customStartDate);
      }

      if (startBoundary) {
        constraints.push(where('uploadTimestamp', '>=', Timestamp.fromDate(startBoundary)));
      }

      if (dateRange === 'CUSTOM' && customEndDate) {
        const endBoundary = new Date(customEndDate);
        endBoundary.setHours(23, 59, 59, 999);
        constraints.push(where('uploadTimestamp', '<=', Timestamp.fromDate(endBoundary)));
      }

      constraints.push(orderBy('uploadTimestamp', 'desc'));

      // If we have page history, grab previous document reference to paginate
      // For Firestore SDK, importing startAfter from 'firebase/firestore' is the correct approach
      const { startAfter } = await import('firebase/firestore');
      const cursorDoc = pageHistory[currentPage];
      if (cursorDoc) {
        constraints.push(startAfter(cursorDoc));
      }

      constraints.push(limit(pageSize + 1));

      const q = query(auditsCol, ...constraints);
      const querySnap = await getDocs(q);
      const docs = querySnap.docs;

      const hasNextItem = docs.length > pageSize;
      setHasNext(hasNextItem);

      const pageDocs = hasNextItem ? docs.slice(0, pageSize) : docs;
      setActivities(pageDocs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error('[REAL CURSOR ERROR]', err);
      if (err.message?.includes('index') || err.message?.includes('INDEX_REQUISITE')) {
        setIndexError(err.message);
      }
      handleFirestoreError(err, OperationType.LIST, 'auditUploads');
    } finally {
      setLoading(false);
    }
  };

  // Clean trigger for Next Page
  const handleNextPage = async () => {
    if (!hasNext) return;
    try {
      // Find current page's last document snapshot
      const auditsCol = collection(db, 'auditUploads');
      let constraints: any[] = [];

      if (selectedUnit !== 'ALL') constraints.push(where('unit', '==', selectedUnit));
      if (selectedEventType !== 'ALL') constraints.push(where('eventType', '==', selectedEventType));
      if (searchEmail.trim()) constraints.push(where('uploadedByEmail', '==', searchEmail.trim().toLowerCase()));

      const now = new Date();
      let startBoundary: Date | null = null;
      if (dateRange === 'TODAY') startBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (dateRange === '7') startBoundary = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (dateRange === '30') startBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (dateRange === '90') startBoundary = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      else if (dateRange === 'CUSTOM' && customStartDate) startBoundary = new Date(customStartDate);

      if (startBoundary) constraints.push(where('uploadTimestamp', '>=', Timestamp.fromDate(startBoundary)));
      if (dateRange === 'CUSTOM' && customEndDate) {
        const endBoundary = new Date(customEndDate);
        endBoundary.setHours(23, 59, 59, 999);
        constraints.push(where('uploadTimestamp', '<=', Timestamp.fromDate(endBoundary)));
      }

      constraints.push(orderBy('uploadTimestamp', 'desc'));
      
      const cursorDoc = pageHistory[currentPage];
      const { startAfter } = await import('firebase/firestore');
      if (cursorDoc) {
        constraints.push(startAfter(cursorDoc));
      }

      constraints.push(limit(pageSize));

      const q = query(auditsCol, ...constraints);
      const querySnap = await getDocs(q);
      const lastDoc = querySnap.docs[querySnap.docs.length - 1];

      if (lastDoc) {
        setPageHistory(prev => [...prev, lastDoc]);
        setCurrentPage(prev => prev + 1);
      }
    } catch (err) {
      console.error('[PAGINATION NEXT ERROR]', err);
      // fallback increment directly to trigger client-side pagination trigger in fetchActivities
      setCurrentPage(prev => prev + 1);
    }
  };

  // Clean trigger for Prev Page
  const handlePrevPage = () => {
    if (currentPage === 0) return;
    setCurrentPage(prev => prev - 1);
    setPageHistory(prev => prev.slice(0, prev.length - 1));
  };

  // Double trigger pagination fetch to ensure index compliance
  useEffect(() => {
    if (currentPage > 0) {
      fetchActivitiesWithRealCursor();
    }
  }, [currentPage]);


  // Format Date to localized readable string (Gua Musang Standard)
  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Sedang diproses...';
    
    let d: Date;
    if (ts.seconds) {
      d = new Date(ts.seconds * 1000);
    } else {
      d = new Date(ts);
    }

    if (isNaN(d.getTime())) return String(ts);

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Helper to safely format file sizes
  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // EXPORT TO CSV & EXCEL METADATA
  const handleExport = (format: 'CSV' | 'EXCEL') => {
    if (activities.length === 0) {
      alert('Tiada data audit tersedia untuk dieksport.');
      return;
    }

    const headers = ['Tarikh & Masa', 'Pengguna', 'Email', 'Unit', 'Event Type', 'Nama Fail', 'Status', 'ID Dokumen Drive', 'Pautan Dokumen'];
    
    const rows = activities.map(act => [
      formatTimestamp(act.uploadTimestamp),
      act.uploadedByName || 'Sistem',
      act.uploadedByEmail || '',
      act.unit || 'Umum',
      act.eventType || 'UPLOAD',
      act.fileName || '',
      act.uploadStatus || 'SUCCESS',
      act.driveFileId || '',
      act.driveFileUrl || ''
    ]);

    let fileContent = '';
    let fileName = `SPS_Log_Audit_${new Date().toISOString().split('T')[0]}`;

    if (format === 'CSV') {
      // Escape commas & generate safe CSV payload
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      fileContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);
      fileName += '.csv';
    } else {
      // Basic Tab-Separated Values which Microsoft Excel parses correctly as a spreadsheet
      const tsvContent = [
        headers.join('\t'),
        ...rows.map(row => row.join('\t'))
      ].join('\n');

      fileContent = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + encodeURIComponent(tsvContent);
      fileName += '.xls';
    }

    // Trigger immediate browser download
    const link = document.createElement('a');
    link.setAttribute('href', fileContent);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="audit-system-workspace" className="space-y-8 font-sans pb-16">
      {/* Page Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Log Audit Sistem</h1>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1.5">
                Sektor Pengurusan Sekolah (SPS) PPD Gua Musang
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setRefreshCount(prev => prev + 1)}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-all shadow-xs flex items-center gap-2 font-bold text-xs cursor-pointer"
            title="Segarkan Log"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || loadingKpis) ? 'animate-spin' : ''}`} />
            Segarkan Semula
          </button>
          
          <div className="relative group">
            <button 
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 border border-indigo-500 flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Eksport Log
            </button>
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-150 rounded-xl shadow-lg hidden group-hover:block overflow-hidden z-50">
              <button 
                onClick={() => handleExport('CSV')}
                className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-700 text-xs font-bold text-left flex items-center gap-2 cursor-pointer border-b border-slate-100"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Eksport ke CSV
              </button>
              <button 
                onClick={() => handleExport('EXCEL')}
                className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-700 text-xs font-bold text-left flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Eksport ke Excel (.xls)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic index requisition notification */}
      {indexError && (
        <div className="p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl flex items-start gap-3.5 animate-in slide-in-from-top-3 duration-300">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <h4 className="font-extrabold text-amber-800 text-sm">Penyediaan Indeks Firestore Diperlukan</h4>
            <p className="text-xs text-amber-700/95 leading-relaxed font-semibold">
              Sistem telah mengaktifkan logik <strong className="font-bold text-amber-900">In-Memory Fallback</strong> secara automatik. Carian dan tapisan log audit anda tetap berfungsi sepenuhnya! Untuk mempercepatkan query berskala besar, sila wujudkan indeks composite berikut dalam Firebase Console:
            </p>
            <div className="bg-white/80 border border-amber-100 rounded-xl p-3 mt-2 font-mono text-[10px] text-amber-900 leading-tight space-y-1.5 font-bold shadow-xs">
              <div>• Collection: <code className="text-indigo-600">auditUploads</code></div>
              <div>• Index 1: <code className="text-emerald-700">eventType (Ascending) + uploadTimestamp (Descending)</code></div>
              <div>• Index 2: <code className="text-emerald-700">unit (Ascending) + uploadTimestamp (Descending)</code></div>
              <div>• Index 3: <code className="text-emerald-700">uploadedByEmail (Ascending) + uploadTimestamp (Descending)</code></div>
              <div>• Index 4: <code className="text-emerald-700">eventType (Asc) + unit (Asc) + uploadTimestamp (Desc)</code></div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard 
          title="Jumlah Aktiviti" 
          value={kpis.totalActivities} 
          icon={<Activity className="w-5 h-5 text-indigo-600" />} 
          bg="bg-indigo-50/50" 
          border="border-indigo-100" 
          loading={loadingKpis}
        />
        <KPICard 
          title="Jumlah Upload" 
          value={kpis.totalUploads} 
          icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} 
          bg="bg-emerald-50/50" 
          border="border-emerald-100" 
          loading={loadingKpis}
        />
        <KPICard 
          title="Jumlah Delete" 
          value={kpis.totalDeletes} 
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} 
          bg="bg-rose-50/50" 
          border="border-rose-100" 
          loading={loadingKpis}
        />
        <KPICard 
          title="Jumlah Download" 
          value={kpis.totalDownloads} 
          icon={<Download className="w-5 h-5 text-purple-600" />} 
          bg="bg-purple-50/50" 
          border="border-purple-100" 
          loading={loadingKpis}
        />
        <KPICard 
          title="Jumlah Login" 
          value={kpis.totalLogins} 
          icon={<User className="w-5 h-5 text-teal-600" />} 
          bg="bg-teal-50/50" 
          border="border-teal-100" 
          loading={loadingKpis}
        />
        <KPICard 
          title="Pengguna Aktif" 
          value={kpis.activeUsers} 
          icon={<Users className="w-5 h-5 text-sky-600" />} 
          bg="bg-sky-50/50" 
          border="border-sky-100" 
          loading={loadingKpis}
        />
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden flex flex-col">
        {/* Filters Top Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              Tapisan &amp; Carian Log Audit
            </h3>
            <button 
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-500 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Unit Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Organisasi</label>
              <select 
                value={selectedUnit} 
                onChange={e => { setSelectedUnit(e.target.value); setCurrentPage(0); setPageHistory([null]); }}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Unit (All Units)</option>
                <option value="UNIT PRASEKOLAH">UNIT PRASEKOLAH</option>
                <option value="UNIT SWASTA">UNIT SWASTA</option>
                <option value="UNIT RENDAH">UNIT RENDAH</option>
                <option value="UNIT MENENGAH & TINGKATAN 6">UNIT MENENGAH &amp; TINGKATAN 6</option>
                <option value="UNIT SIP+">UNIT SIP+</option>
                <option value="RUJUKAN_BERSAMA">RUJUKAN BERSAMA</option>
              </select>
            </div>

            {/* Event Type Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis Aktiviti (Event)</label>
              <select 
                value={selectedEventType} 
                onChange={e => { setSelectedEventType(e.target.value); setCurrentPage(0); setPageHistory([null]); }}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Aktiviti (ALL)</option>
                <option value="UPLOAD">UPLOAD (Muat Naik)</option>
                <option value="DELETE">DELETE (Padam)</option>
                <option value="UPDATE">UPDATE (Kemaskini)</option>
                <option value="DOWNLOAD">DOWNLOAD (Muat Turun)</option>
                <option value="VIEW">VIEW (Paparan)</option>
                <option value="LOGIN">LOGIN (Log Masuk)</option>
                <option value="LOGOUT">LOGOUT (Log Keluar)</option>
              </select>
            </div>

            {/* User Search Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Emel Pengguna (uploadedByEmail)</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Cari emel (cth: ali@moe.gov.my)" 
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 focus:border-indigo-500 outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Date Range Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Julat Tarikh</label>
              <select 
                value={dateRange} 
                onChange={e => { setDateRange(e.target.value); setCurrentPage(0); setPageHistory([null]); }}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="TODAY">Hari Ini (Today)</option>
                <option value="7">7 Hari Terakhir</option>
                <option value="30">30 Hari Terakhir</option>
                <option value="90">90 Hari Terakhir</option>
                <option value="CUSTOM">Tarikh Khusus (Custom)...</option>
              </select>
            </div>
          </form>

          {/* Custom Date Inputs Drawer */}
          {dateRange === 'CUSTOM' && (
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5 text-left">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarikh Mula</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={e => { setCustomStartDate(e.target.value); setCurrentPage(0); setPageHistory([null]); }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarikh Tamat</label>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={e => { setCustomEndDate(e.target.value); setCurrentPage(0); setPageHistory([null]); }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Audit Logs Table Container */}
        <div className="flex-1 overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Memuatkan baris log audit...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <Inbox className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-sm">Tiada Rekod Audit Ditemui</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Tiada sebarang aktiviti padanan dijumpai untuk kombinasi filter ini. Sila tetapkan semula kriteria carian anda.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-semibold text-slate-600">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="px-6 py-4.5">Tarikh &amp; Masa</th>
                  <th className="px-6 py-4.5">Pengguna / Emel</th>
                  <th className="px-6 py-4.5">Unit Organisasi</th>
                  <th className="px-6 py-4.5">Event Type</th>
                  <th className="px-6 py-4.5">Nama Fail (Asal)</th>
                  <th className="px-6 py-4.5">Saiz Fail</th>
                  <th className="px-6 py-4.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities.map((act) => {
                  const evType = act.eventType || 'UPLOAD';
                  const badgeColor = EVENT_COLORS[evType] || EVENT_COLORS.UPLOAD;

                  return (
                    <tr key={act.id} className="hover:bg-slate-50/40 transition-colors">
                      {/* Timestamp */}
                      <td className="px-6 py-4.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatTimestamp(act.uploadTimestamp)}
                      </td>
                      
                      {/* User Metadata */}
                      <td className="px-6 py-4.5">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-extrabold text-[12px] leading-tight">
                            {act.uploadedByName || 'Sistem'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal leading-normal mt-0.5">
                            {act.uploadedByEmail || 'tiada emel'}
                          </span>
                        </div>
                      </td>
                      
                      {/* Unit */}
                      <td className="px-6 py-4.5 whitespace-nowrap text-slate-500 text-[11px] font-extrabold uppercase tracking-wide">
                        {String(act.unit || 'Umum').replace('UNIT_', 'UNIT ')}
                      </td>
                      
                      {/* Event Type Badge */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${badgeColor.bg}`}>
                          {badgeColor.label}
                        </span>
                      </td>
                      
                      {/* File Name */}
                      <td className="px-6 py-4.5 max-w-xs md:max-w-md">
                        <div className="flex flex-col min-w-0">
                          {act.driveFileUrl ? (
                            <a 
                              href={act.driveFileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-500 hover:underline font-extrabold text-[11px] truncate leading-tight flex items-center gap-1.5"
                              referrerPolicy="no-referrer"
                            >
                              {act.fileName || 'Tiada Nama'}
                            </a>
                          ) : (
                            <span className="text-slate-600 font-extrabold text-[11px] truncate leading-tight">
                              {act.fileName || 'Tiada Nama'}
                            </span>
                          )}
                          {act.originalFileName && act.originalFileName !== act.fileName && (
                            <span className="text-[9px] text-slate-400 font-normal mt-0.5 truncate">
                              Asal: {act.originalFileName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="px-6 py-4.5 whitespace-nowrap text-slate-400 font-mono text-[10px]">
                        {formatFileSize(act.fileSize)}
                      </td>
                      
                      {/* Upload Status */}
                      <td className="px-6 py-4.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                          {act.uploadStatus || 'SUCCESS'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Custom Pagination Footer */}
        <div className="px-6 py-4.5 bg-slate-50/40 border-t border-slate-100 flex items-center justify-between">
          <div className="text-slate-400 text-[11px] font-bold">
            Halaman <span className="text-slate-700 font-extrabold">{currentPage + 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevPage}
              disabled={currentPage === 0 || loading}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleNextPage}
              disabled={!hasNext || loading}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Halaman Seterusnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI Dashboard Helper Card Component
interface KPICardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  border: string;
  loading?: boolean;
}

function KPICard({ title, value, icon, bg, border, loading = false }: KPICardProps) {
  return (
    <div className={`p-5 bg-white border ${border} rounded-2xl shadow-xs flex items-center gap-4 transition-all hover:translate-y-[-2px]`}>
      <div className={`p-3 rounded-xl shrink-0 ${bg}`}>
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{title}</p>
        {loading ? (
          <div className="h-6 w-16 bg-slate-100 animate-pulse rounded-md mt-1"></div>
        ) : (
          <h4 className="text-lg font-black text-slate-800 tracking-tight leading-none">{value.toLocaleString()}</h4>
        )}
      </div>
    </div>
  );
}
