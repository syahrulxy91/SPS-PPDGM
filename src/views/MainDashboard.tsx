import React, { useState, useEffect } from 'react';
import { 
  FileText, Users, Building, Activity, UploadCloud, ChevronRight, 
  Clock, LayoutGrid, Settings, HardDrive, Database, Shield, ShieldCheck, 
  UserCheck, UserPlus, Plus, Trash2, ArrowRight, CheckCircle, RefreshCw, AlertCircle, Eye, Info, Server, Layers, HelpCircle, Search,
  Calendar, Check, CheckSquare, Sparkles, TrendingUp, Key, ArrowUpRight, FolderOpen
} from 'lucide-react';
import { readRows, initSheets } from '../lib/sheets';
import { initDriveFolders, resetDriveFoldersCache } from '../lib/drive';
import { getGoogleDriveConfigSync, saveGoogleDriveConfig, fetchGoogleDriveConfig, db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { getCurrentAppUser } from '../lib/auth';
import { getUnitDisplayName } from '../types';

// Helper to prevent Firestore connection from hanging indefinitely on write if blocked/offline
const withWriteTimeout = <T extends unknown>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('TIMEOUT: Operasi mengambil masa terlalu lama. Sila semak sambungan internet.'));
    }, timeoutMs);
    promise.then(
      (result) => { clearTimeout(timer); resolve(result); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
};

export default function MainDashboard() {
  const user = getCurrentAppUser();
  const isSuperAdminUser = user?.role === 'SUPER ADMIN' || 
                           user?.email?.toLowerCase() === 'syahrulxy91@gmail.com';

  const [loading, setLoading] = useState(() => {
    const cachedStats = localStorage.getItem('sps_dashboard_stats');
    return cachedStats ? false : true;
  });
  const [stats, setStats] = useState(() => {
    const cached = localStorage.getItem('sps_dashboard_stats');
    return cached ? JSON.parse(cached) : { total: 0, currentMonth: 0, activeUnits: 8, activeUsers: 0 };
  });
  const [chartData, setChartData] = useState<any[]>(() => {
    const cached = localStorage.getItem('sps_dashboard_chart');
    return cached ? JSON.parse(cached) : [];
  });
  const [recentReports, setRecentReports] = useState<any[]>(() => {
    const cached = localStorage.getItem('sps_dashboard_recent');
    return cached ? JSON.parse(cached) : [];
  });
  const [activeTab, setActiveTab] = useState<'struktur' | 'log'>('struktur');

  // Super Admin view state toggle
  const [showStandardPreview, setShowStandardPreview] = useState(false);

  // Super Admin administrative panel tabs
  const [adminSectionTab, setAdminSectionTab] = useState<'status' | 'drive' | 'source' | 'roles'>('status');

  // Centralized Google Drive Configuration state
  const [googleDriveConfig, setGoogleDriveConfig] = useState(() => getGoogleDriveConfigSync());

  // Compatibility helper variables
  const rootFolder = googleDriveConfig.googleDriveRootFolderId;
  const setRootFolder = (val: string) => {
    setGoogleDriveConfig(prev => ({ ...prev, googleDriveRootFolderId: val }));
  };

  const [unitFolders, setUnitFolders] = useState<Record<string, string>>(() => {
    const custom = localStorage.getItem('sps_drive_unit_folders');
    if (custom) {
      try {
        return JSON.parse(custom);
      } catch (e) {
        // ignore
      }
    }
    return {
      'UNIT_PRASEKOLAH': 'UNIT_PRASEKOLAH',
      'UNIT_RENDAH': 'UNIT_RENDAH',
      'UNIT_MENENGAH': 'UNIT_MENENGAH',
      'UNIT_SWASTA': 'UNIT_SWASTA',
      'SIP': 'SIP',
      'RUJUKAN_BERSAMA': 'RUJUKAN_BERSAMA'
    };
  });

  // Registered Emails management parameters
  const [registeredEmails, setRegisteredEmails] = useState<Record<string, { email: string; createdAt?: string; createdBy?: string }>>(() => {
    const custom = localStorage.getItem('sps_registered_emails');
    return custom ? JSON.parse(custom) : {};
  });

  const [loggedInUsers, setLoggedInUsers] = useState<any[]>(() => {
    const custom = localStorage.getItem('sps_logged_in_users');
    return custom ? JSON.parse(custom) : [];
  });

  // Source configuration
  const [primaryFileSource, setPrimaryFileSource] = useState(() => {
    return localStorage.getItem('sps_primary_file_source') || 'local_storage';
  });

  // Registered Emails addition form parameters
  const [newEmail, setNewEmail] = useState('');

  // Status indicators for saves
  const [driveSaveSuccess, setDriveSaveSuccess] = useState(false);
  const [sourceSaveSuccess, setSourceSaveSuccess] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync registeredEmails from Firestore in real-time
  useEffect(() => {
    const colRef = collection(db, 'registeredEmails');
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const emailList: Record<string, { email: string; createdAt?: string; createdBy?: string }> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        emailList[docSnap.id.toLowerCase()] = {
          email: data.email || docSnap.id,
          createdAt: data.createdAt,
          createdBy: data.createdBy
        };
      });
      setRegisteredEmails(emailList);
      localStorage.setItem('sps_registered_emails', JSON.stringify(emailList));
    }, (err) => {
      console.warn("Gagal mematangkan registeredEmails dari Firebase:", err);
      if (auth.currentUser) {
        handleFirestoreError(err, OperationType.GET, 'registeredEmails');
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch metrics data on component mount
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedConfig, _folders, _sheetsResult, laporan] = await Promise.all([
          fetchGoogleDriveConfig(),
          initDriveFolders(),
          initSheets(),
          readRows('Laporan')
        ]);
        const finalConfig = loadedConfig || googleDriveConfig;
        setGoogleDriveConfig(finalConfig);
        const header = laporan[0] || [];
        const data = laporan.slice(1).map(row => {
          const obj: any = {};
          header.forEach((h: string, i: number) => {
            obj[h] = row[i];
          });
          return obj;
        });

        // Compute real statistics
        const now = new Date();
        const cm = (now.getMonth() + 1).toString().padStart(2, '0');
        const cy = now.getFullYear().toString();

        let currMonthCount = 0;
        const unitStats: Record<string, number> = {};
        const activeEmails = new Set<string>();

        data.forEach(row => {
          if (row.bulan === cm && row.tahun === cy) {
            currMonthCount++;
          }
          if (row.unit) {
            unitStats[row.unit] = (unitStats[row.unit] || 0) + 1;
          }
          if (row.uploadedBy) {
            activeEmails.add(row.uploadedBy.toLowerCase());
          }
        });

        const formattedChartData = Object.keys(unitStats).map(unit => ({
          name: getUnitDisplayName(unit).replace('Unit ', '').replace(' & Tingkatan 6', ''),
          jumlah: unitStats[unit]
        })).sort((a,b) => b.jumlah - a.jumlah);

        const calculatedStats = {
          total: data.length,
          currentMonth: currMonthCount,
          activeUnits: Object.keys(unitStats).length || 8,
          activeUsers: activeEmails.size || 1
        };
        const calculatedRecent = data.reverse().slice(0, 5);

        setStats(calculatedStats);
        setChartData(formattedChartData);
        setRecentReports(calculatedRecent);

        // Store cache for instant startup in client-side loading
        localStorage.setItem('sps_dashboard_stats', JSON.stringify(calculatedStats));
        localStorage.setItem('sps_dashboard_chart', JSON.stringify(formattedChartData));
        localStorage.setItem('sps_dashboard_recent', JSON.stringify(calculatedRecent));

      } catch (err) {
        console.error('Error loading analytics', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save drive setup
  const handleSaveDriveConfig = async () => {
    const updatedByEmail = user?.email || 'syahrulxy91@gmail.com';
    const updatedConfig = {
      googleDriveEnabled: googleDriveConfig.googleDriveEnabled,
      googleDriveRootFolderId: googleDriveConfig.googleDriveRootFolderId,
      updatedBy: updatedByEmail
    };

    try {
      await saveGoogleDriveConfig(updatedConfig);
      setGoogleDriveConfig(updatedConfig);
      localStorage.setItem('sps_drive_root_folder', updatedConfig.googleDriveRootFolderId);
      localStorage.setItem('sps_drive_unit_folders', JSON.stringify(unitFolders));
      resetDriveFoldersCache();
      setDriveSaveSuccess(true);
      setTimeout(() => setDriveSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Gagal menyelaraskan konfigurasi Google Drive ke Firestore Pelayan.');
    }
  };

  const handleResetDriveCache = () => {
    resetDriveFoldersCache();
    alert('Cache direktori Google Drive telah dibasuh sepenuhnya. Rekod akan dibina semula apabila halaman dimuat semula.');
  };

  const handleRestoreDriveDefaults = async () => {
    if (confirm('Adakah anda pasti mahu set semula nama direktori folder unit kepada tetapan asal laluan kilang?')) {
      const defaults = {
        'UNIT_PRASEKOLAH': 'UNIT_PRASEKOLAH',
        'UNIT_RENDAH': 'UNIT_RENDAH',
        'UNIT_MENENGAH': 'UNIT_MENENGAH',
        'UNIT_SWASTA': 'UNIT_SWASTA',
        'SIP': 'SIP',
        'RUJUKAN_BERSAMA': 'RUJUKAN_BERSAMA'
      };

      const restoredConfig = {
        googleDriveEnabled: true,
        googleDriveRootFolderId: '1-Gdkrl8YiQ-pJzi_vSV940qDRv_9OEaH',
        updatedBy: user?.email || 'syahrulxy91@gmail.com'
      };

      try {
        await saveGoogleDriveConfig(restoredConfig);
        setGoogleDriveConfig(restoredConfig);
        setUnitFolders(defaults);
        localStorage.setItem('sps_drive_root_folder', '1-Gdkrl8YiQ-pJzi_vSV940qDRv_9OEaH');
        localStorage.setItem('sps_drive_unit_folders', JSON.stringify(defaults));
        resetDriveFoldersCache();
        setDriveSaveSuccess(true);
        setTimeout(() => setDriveSaveSuccess(false), 2000);
      } catch (e) {
        console.error(e);
        alert('Gagal mengembalikan konfigurasi asal ke Firestore.');
      }
    }
  };

  // Save source setup
  const handleSaveSourceConfig = (source: string) => {
    setPrimaryFileSource(source);
    localStorage.setItem('sps_primary_file_source', source);
    setSourceSaveSuccess(true);
    setTimeout(() => setSourceSaveSuccess(false), 2000);
  };

  // Add registered email
  const handleAddRegisteredEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      alert("Sila masukkan email terlebih dahulu.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Format email tidak sah.");
      return;
    }

    if (email === 'syahrulxy91@gmail.com') {
      alert("Akaun Super Admin utama sentiasa berdaftar dan tidak boleh ditambah.");
      return;
    }

    if (registeredEmails[email]) {
      alert("Email ini sudah didaftarkan.");
      return;
    }

    const payload = {
      email,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || 'syahrulxy91@gmail.com'
    };

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('Auth tidak aktif - auth.currentUser adalah null');
      alert('Sesi log masuk tamat. Sila log keluar dan log masuk semula.');
      return;
    }

    try {
      // Force token refresh untuk pastikan token segar
      await currentUser.getIdToken(true);

      // Direct Firestore write with timeout safety (defaults to 8000ms)
      await withWriteTimeout(setDoc(doc(db, 'registeredEmails', email), payload));

      setNewEmail('');
      setRoleSaveSuccess(true);
      setTimeout(() => setRoleSaveSuccess(false), 2000);

      // Optimistic/Immediate UI Fallbacks
      const updated = {
        ...registeredEmails,
        [email]: payload
      };
      localStorage.setItem('sps_registered_emails', JSON.stringify(updated));
      setRegisteredEmails(updated);
    } catch (err: any) {
      console.error('Gagal mendaftar email ke Firestore:', err);
      alert('Pendaftaran email gagal. Firestore menolak operasi. Sila semak sambungan atau log masuk semula.');
      handleFirestoreError(err, OperationType.WRITE, 'registeredEmails/' + email);
    }
  };

  // Delete registered email
  const handleRemoveRegisteredEmail = async (email: string) => {
    const emailLower = email.toLowerCase();
    if (emailLower === 'syahrulxy91@gmail.com') {
      alert("Tidak boleh memadam akaun utama Super Admin.");
      return;
    }

    if (!window.confirm(`Adakah anda pasti mahu memadam ${email} daripada senarai email berdaftar?`)) {
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('Auth tidak aktif - auth.currentUser adalah null');
      alert('Sesi log masuk tamat. Sila log keluar dan log masuk semula.');
      return;
    }

    try {
      // Force token refresh untuk pastikan token segar
      await currentUser.getIdToken(true);

      // Direct Firestore delete with timeout safety (defaults to 8000ms)
      await withWriteTimeout(deleteDoc(doc(db, 'registeredEmails', emailLower)));

      const updated = { ...registeredEmails };
      delete updated[emailLower];
      localStorage.setItem('sps_registered_emails', JSON.stringify(updated));
      setRegisteredEmails(updated);
    } catch (err: any) {
      console.error('Gagal memadam email berdaftar dari Firestore:', err);
      alert('Pemadaman email gagal. Firestore menolak operasi. Sila semak sambungan atau log masuk semula.');
      handleFirestoreError(err, OperationType.DELETE, 'registeredEmails/' + emailLower);
    }
  };

  const filteredUsers = loggedInUsers.filter(u => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div id="dashboard-loader" className="flex flex-col items-center justify-center py-24 text-slate-500 font-medium">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <span className="text-sm font-semibold text-slate-600">Sila tunggu, sedang memuatkan analisa sistem...</span>
      </div>
    );
  }

  // STANDARD VISITOR VIEW FUNCTION
  const renderStandardDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Card Redesign */}
      <div id="welcome-bar" className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-slate-950/15 border border-indigo-500/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div id="ambient-mesh" className="absolute -right-10 -bottom-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-3 z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1 px-2.5 bg-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase rounded-full tracking-wider border border-indigo-500/20 shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-300" />
              SPS GUA MUSANG
            </span>
            <span className="text-slate-400 text-xs flex items-center gap-1 text-slate-300 font-medium font-mono">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Papan Pemuka Utama e-Laporan
          </h1>
          <p className="text-slate-300 max-w-xl text-xs sm:text-sm font-medium leading-relaxed">
            Sistem maklumat pengurusan rasmi sekolah dan pengarkiban rekod di bawah Sektor Pengurusan Sekolah. Selamat datang, <span className="font-bold text-white uppercase">{user?.name}</span>.
          </p>
        </div>

        {isSuperAdminUser && (
          <button 
            type="button"
            onClick={() => setShowStandardPreview(false)}
            className="px-4.5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/15 flex items-center gap-2 transition-all cursor-pointer z-10 border border-indigo-500"
          >
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            Kembali ke Portal Super Admin
          </button>
        )}
      </div>

      {/* KPI Cards Redesign */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIBox title="Laporan Berdaftar" value={stats.total} icon={<FileText className="text-indigo-500" />} trend="+3 fail minggu ini" color="indigo" />
        <KPIBox title="Bulan Semasa" value={stats.currentMonth} icon={<Activity className="text-emerald-500" />} trend="Laporan Jun 2026" color="emerald" />
        <KPIBox title="Unit Terlibat" value={stats.activeUnits} icon={<Building className="text-rose-500" />} trend="Kemas kini automatik" color="rose" />
        <KPIBox title="Pegawai Aktif" value={stats.activeUsers} icon={<Users className="text-violet-500" />} trend="Dwi-Autentikasi" color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts Card Redesign */}
        <div id="chart-card" className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-7 hover:border-indigo-500/20 transition-all">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-50">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Statistik Penyerahan Mengikut Unit
              </h2>
              <p className="text-xs text-slate-400">Peta visual menunjukkan volum dokumen berdaftar bagi setiap unit.</p>
            </div>
          </div>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                    itemStyle={{ color: '#0F172A', fontSize: '11px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#64748B', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Bar dataKey="jumlah" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">Memuatkan data carta...</div>
            )}
          </div>
        </div>

        {/* Recent Reports Card Redesign */}
        <div id="recent-reports-card" className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col hover:border-indigo-500/20 transition-all">
          <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-50">
            <div className="space-y-1">
              <h2 className="text-base font-black text-slate-800 tracking-tight">Dokumen Mutakhir</h2>
              <p className="text-xs text-slate-400">Muat naik terbaru sektor.</p>
            </div>
            <Link to="/dashboard/carian" className="text-xs text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-xl font-bold transition-colors">
              Lihat Semua
            </Link>
          </div>
          
          <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[290px] pr-1">
            {recentReports.length > 0 ? recentReports.map((report, i) => (
              <div key={i} className="flex items-start space-x-3.5 pb-3.5 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 border border-slate-100 shadow-2xs">
                  <FileText className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-extrabold text-slate-700 truncate" title={report.name}>{report.name}</h3>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span className="truncate max-w-[120px] font-bold text-indigo-500 px-1.5 py-0.5 rounded-md bg-indigo-50 font-mono text-[9px] uppercase">{report.unit?.replace('UNIT_', '')}</span>
                    <span className="text-slate-400 font-medium shrink-0">{new Date(report.uploadedAt).toLocaleDateString('ms-MY')}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-xs text-slate-400 text-center py-10">Belum ada laporan dimuat naik.</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation Section Redesign */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:border-indigo-500/20 transition-all">
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('struktur')}
            className={`flex items-center gap-2.5 px-6 py-4.5 text-xs sm:text-sm transition-all relative rounded-2xl flex-1 justify-center ${
              activeTab === 'struktur' 
                ? 'text-indigo-600 bg-white shadow-sm font-bold' 
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <LayoutGrid className="w-4.5 h-4.5 shrink-0 text-indigo-500" />
            Struktur Unit Sektor Pengurusan Sekolah
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex items-center gap-2.5 px-6 py-4.5 text-xs sm:text-sm transition-all relative rounded-2xl flex-1 justify-center ${
              activeTab === 'log' 
                ? 'text-indigo-600 bg-white shadow-sm font-bold' 
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Clock className="w-4.5 h-4.5 shrink-0 text-indigo-500" />
            Log Aktiviti Sektor Gua Musang
            <span className="relative flex h-2.5 w-2.5 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'struktur' ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-500" />
                    Direktori Unit e-Laporan
                  </h3>
                  <p className="text-xs text-slate-400">Sila klik mana-mana unit di bawah untuk terus mengakses seksyen laporan unit tersebut.</p>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-black border border-slate-200">5 UNIT UTAMA</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { name: 'Unit Prasekolah', path: 'unit-prasekolah', desc: 'Pengurusan kebajikan & aktiviti tahunan prasekolah.', code: 'UP' },
                  { name: 'Unit Rendah', path: 'unit-rendah', desc: 'Akademik, penempatan murid & bantuan sekolah rendah.', code: 'UR' },
                  { name: 'Unit Menengah & Tingkatan 6', path: 'unit-menengah', desc: 'Akademik, penempatan murid & bantuan sekolah menengah serta tingkatan 6.', code: 'UM' },
                  { name: 'Unit Swasta', path: 'unit-swasta', desc: 'Pengurusan operasi sekolah swasta, pendaftaran & pelaporan.', code: 'US' },
                  { name: 'SIP+', path: 'sip', desc: 'Sokongan Instruksional Pemimpin Sekolah (SIP+) Gua Musang.', code: 'SIP' }
                ].map((unit, i) => (
                  <Link 
                    key={unit.path} 
                    to={`/dashboard/unit/${unit.path}`}
                    className="group border border-slate-100 p-5 rounded-2xl bg-slate-50/40 hover:bg-white hover:border-indigo-500 hover:scale-[1.01] hover:shadow-md transition-all flex flex-col justify-between min-h-[140px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black font-mono text-indigo-500 px-2 py-0.5 rounded bg-indigo-50 uppercase tracking-widest">{unit.code}</span>
                        <span className="text-[10px] text-slate-300 font-bold">#UNIT_{i + 1}</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm group-hover:text-indigo-600 leading-tight">{unit.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-medium line-clamp-2">{unit.desc}</p>
                    </div>
                    <div className="mt-4 pt-2.5 border-t border-slate-100/50 flex justify-end">
                      <span className="text-[10px] font-extrabold text-indigo-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Masuk 
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Log Aktiviti Terkini Sektor Pengurusan Sekolah</h3>
                  <p className="text-xs text-slate-400">Rekod penyerahan laporan masa-nyata sistem pengurusan.</p>
                </div>
                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-black border border-emerald-200/50 flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Sistem Aktif
                </span>
              </div>
              
              <div className="max-h-[300px] overflow-y-auto space-y-3.5 pr-1">
                {recentReports.map((report, idx) => (
                  <div key={`real-${idx}`} className="text-xs text-slate-600 leading-relaxed border-l-2 border-indigo-500 pl-4 py-2 bg-slate-50/60 rounded-r-xl border border-slate-100/40 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                    <div>
                      Sistem mengesan fail: Pengguna <span className="font-bold text-slate-800">{report.uploadedBy || 'Pegawai Sistem'}</span> memuat naik <span className="font-extrabold text-indigo-600">{report.name}</span> bagi unit <span className="font-black text-slate-700 font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">{report.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold shrink-0 font-mono">
                      {new Date(report.uploadedAt).toLocaleDateString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                
                <div className="text-xs text-slate-600 leading-relaxed border-l-2 border-blue-500 pl-4 py-2 bg-slate-50/30 rounded-r-xl border border-slate-100/40 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    Pengguna <span className="font-bold text-slate-800">Ahmad Zaki bin Yusof</span> menghantar <span className="font-extrabold text-blue-700">Laporan Pemantauan Sukan Sek. Rendah (Unit Sukan)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold shrink-0 font-mono">
                    Kekal disimpan di Google Drive
                  </div>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed border-l-2 border-emerald-500 pl-4 py-2 bg-slate-50/30 rounded-r-xl border border-slate-100/40 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    Pengguna <span className="font-bold text-slate-800">Siti Mariam binti Ismail</span> menghantar <span className="font-extrabold text-emerald-700">Laporan Penilaian Kokurikulum PPD</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold shrink-0 font-mono">
                    Cloud Sheets Disegerakkan
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // IF USER IS NOT SUPER ADMIN OR PREVIEW BUTTON IS TRUE, RENDER VISITOR PREVIEW
  if (!isSuperAdminUser || showStandardPreview) {
    return (
      <div id="standard-dashboard-mode" className="space-y-6">
        {isSuperAdminUser && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md border border-amber-400/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-2xl border border-white/10 shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-100 shrink-0 animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                <span className="font-black uppercase tracking-wider block text-[10px] text-amber-200">Pratinjau Integrasi Aktif</span>
                Anda sedang melayari sistem sebagai Pegawai Standard bagi menyemak struktur paparan.
              </p>
            </div>
            <button
              onClick={() => setShowStandardPreview(false)}
              className="px-4 py-2 bg-white hover:bg-orange-50 text-amber-950 font-black text-xs rounded-xl shadow-sm border border-transparent transition-all cursor-pointer shrink-0"
            >
              Urus Urusan Super Admin
            </button>
          </div>
        )}
        {renderStandardDashboard()}
      </div>
    );
  }

  // EXCLUSIVE SUPER ADMIN WORKSPACE (Loads conditionally on main login)
  return (
    <div id="superadmin-workspace-mode" className="space-y-7 animate-in fade-in duration-500">
      
      {/* Premium Admin Header Section Redesign */}
      <div className="bg-gradient-to-br from-slate-950 via-[#0A192F] to-slate-900 text-white p-7 sm:p-9 rounded-3xl shadow-xl border border-[#1B2C4E] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div id="mesh-effect-adm" className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-3 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="p-1 px-2.5 bg-rose-500/20 text-rose-300 text-[10px] font-black tracking-widest text-white rounded-lg flex items-center gap-1 border border-rose-500/20">
              <Shield className="w-3.5 h-3.5 text-rose-300" />
              PORTAL KAWALAN SUPER ADMIN
            </span>
            <span className="text-xs text-slate-400 font-semibold tracking-wider font-mono uppercase bg-[#172A45] px-2 py-0.5 rounded border border-[#1F3A60]">Real-Time Sync</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            Sistem Kawalan Integrasi &amp; Pentadbir
          </h1>
          <p className="text-slate-300 max-w-2xl text-xs sm:text-sm font-medium leading-relaxed">
            Selamat datang semula, <span className="font-extrabold text-white text-indigo-300 uppercase">{user?.name}</span>. Uruskan dwi-saluran storan Google Drive, selaraskan skop OAuth, dan sahkan hak akses peranti kakitangan PPD secara terpusat.
          </p>
        </div>

        <button
          onClick={() => setShowStandardPreview(true)}
          className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-600/15 border border-indigo-400/40 transition-all cursor-pointer z-10 hover:scale-[1.02]"
        >
          <Eye className="w-4 h-4 text-indigo-200" />
          Pratinjau Dashboard Pegawai
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Admin Modules Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50">
        {[
          { id: 'status', label: 'Monitor & Status', icon: <Layers className="w-4.5 h-4.5" /> },
          { id: 'drive', label: 'Struktur Google Drive', icon: <HardDrive className="w-4.5 h-4.5" /> },
          { id: 'source', label: 'Punca Storan Fail', icon: <Server className="w-4.5 h-4.5" /> },
          { id: 'roles', label: 'Email User Berdaftar', icon: <UserCheck className="w-4.5 h-4.5" /> }
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setAdminSectionTab(btn.id as any)}
            className={`py-3.5 px-5.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              adminSectionTab === btn.id 
                ? 'bg-[#0A192F] text-white shadow-md shadow-[#0A192F]/15 border border-[#1B2C4E] font-bold' 
                : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 font-medium'
            }`}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Admin Tabs Content Renderer */}
      <div className="bg-white rounded-3xl border border-slate-200/75 p-6 sm:p-8 shadow-xs">
        
        {/* MODULE 1: MONITOR & LOG STATUS COMPONENT */}
        {adminSectionTab === 'status' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <h3 className="font-extrabold text-[#0A192F] text-base">Metrik &amp; Kesihatan Sektor</h3>
                <p className="text-xs text-slate-400">Pemantauan fail disimpan dan perkhidmatan sistem semasa.</p>
              </div>
              <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold px-2.5 py-1 rounded-lg">SISTEM KEKAL AKTIF</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <KPIBox title="Laporan Berdaftar" value={stats.total} icon={<FileText className="text-indigo-500" />} trend="Semua unit digabung" color="indigo" />
              <KPIBox title="Sektor Folders" value={9} icon={<Building className="text-violet-500" />} trend="Disediakan di e-Laporan" color="violet" />
              <KPIBox title="Kakitangan Aktif" value={loggedInUsers.length || 1} icon={<Users className="text-amber-500" />} trend="Akses Google Auth" color="amber" />
              <KPIBox title="Bulan Semasa" value={stats.currentMonth} icon={<Activity className="text-emerald-500" />} trend="Kemas kini Jun 22" color="emerald" />
            </div>

            <div className="border border-slate-100 rounded-3xl p-5 bg-slate-50/50">
              <h4 className="text-xs font-extrabold text-[#0A192F] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Log Mutakhir Aktiviti Pegawai
              </h4>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {recentReports.map((report, i) => (
                  <div key={i} className="text-xs py-3 px-4 bg-white border border-slate-100 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xs hover:border-indigo-500/10 transition-colors">
                    <span className="text-slate-600 font-semibold">
                      Pegawai <span className="font-extrabold text-slate-800">{report.uploadedBy || 'Pentadbir'}</span> memuat naik <span className="text-indigo-600 font-extrabold font-mono">{report.name}</span>
                    </span>
                    <span className="text-slate-400 font-semibold font-mono text-[10px] shrink-0 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{new Date(report.uploadedAt).toLocaleDateString('ms-MY')}</span>
                  </div>
                ))}
                <div className="text-xs py-3 px-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center text-slate-400 font-semibold">
                  <span>Enjin Google Drive simulasi sedia digunakan pada simpanan selamat.</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-black font-mono">AKTIF</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 2: GOOGLE DRIVE STORAGE CONFIGURATION */}
        {adminSectionTab === 'drive' && (
          <div className="space-y-7 animate-in fade-in duration-300">
            <div className="bg-indigo-50/80 border border-indigo-100 text-[#0f2d52] p-5 rounded-2xl text-xs space-y-2 flex items-start gap-3.5">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <Info className="w-5 h-5 text-indigo-600 shrink-0" />
              </div>
              <div>
                <p className="font-extrabold text-indigo-950">Konfigurasi Pengarkiban Google Drive</p>
                <p className="text-slate-500 leading-relaxed font-semibold">
                  Semua muat naik fail diletakkan secara dinamik di bawah direktori folder induk. Anda boleh menetapkan punca Google Drive ID dan label nama folder bagi setiap unit di sini.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">ID Root Folder Google Drive (Terpusat):</label>
                    <input
                      type="text"
                      value={googleDriveConfig.googleDriveRootFolderId}
                      onChange={(e) => setGoogleDriveConfig({
                        ...googleDriveConfig,
                        googleDriveRootFolderId: e.target.value
                      })}
                      placeholder="e.g. 1-Gdkrl8YiQ-pJzi_vSV940qDRv_9OEaH"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs sm:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-bold font-mono transition-all"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold">Punca Utama: <span className="font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">systemSettings/googleDriveConfig (Firestore)</span></p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="relative flex items-start">
                      <div className="flex h-5 items-center">
                        <input
                          type="checkbox"
                          id="googleDriveEnabled"
                          checked={googleDriveConfig.googleDriveEnabled}
                          onChange={(e) => setGoogleDriveConfig({
                            ...googleDriveConfig,
                            googleDriveEnabled: e.target.checked
                          })}
                          className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="ml-2.5 text-xs">
                        <label htmlFor="googleDriveEnabled" className="font-black text-slate-700 cursor-pointer">
                          Aktifkan Penulisan Awan Google Drive (Dwi-Mod)
                        </label>
                        <p className="text-slate-400 font-medium leading-normal">Apabila diaktifkan, fail akan ditulis terus di Google Drive cloud peranti secara dwi-storan.</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug font-semibold">Diselia terakhir oleh: <span className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">{googleDriveConfig.updatedBy}</span></p>
                </div>
                <div className="flex xl:flex-col lg:flex-row flex-col justify-end gap-2.5 pb-1 lg:items-end">
                  <button
                    onClick={handleResetDriveCache}
                    className="px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-hover" />
                    Reset Cache Drive
                  </button>
                  <button
                    onClick={handleRestoreDriveDefaults}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                  >
                    Set Semula ID Asal
                  </button>
                </div>
              </div>

              <div className="h-[1px] bg-slate-100 my-4"></div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-indigo-500" />
                  Subfolder Unit e-Laporan (Label Drive)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Unit Prasekolah', key: 'UNIT_PRASEKOLAH' },
                    { label: 'Unit Rendah', key: 'UNIT_RENDAH' },
                    { label: 'Unit Menengah & Tingkatan 6', key: 'UNIT_MENENGAH' },
                    { label: 'Unit Swasta', key: 'UNIT_SWASTA' },
                    { label: 'SIP+', key: 'SIP' },
                    { label: 'Bahan Rujukan Bersama', key: 'RUJUKAN_BERSAMA' }
                  ].map((u) => (
                    <div key={u.key} className="space-y-1.5 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl hover:border-indigo-500/10 transition-colors">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{u.label}</label>
                      <input
                        type="text"
                        value={unitFolders[u.key] || ''}
                        onChange={(e) => {
                          setUnitFolders({
                            ...unitFolders,
                            [u.key]: e.target.value
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none transition-shadow"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-slate-100">
                {driveSaveSuccess ? (
                  <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1.5 animate-pulse bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle className="w-4 h-4" />
                    Konfigurasi Google Drive berjaya disimpan!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-semibold">Semua perubahan disimpan serta-merta ke enjin penyimpanan pelayar anda.</span>
                )}
                <button
                  onClick={handleSaveDriveConfig}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/10 flex items-center gap-2 transition-all cursor-pointer border border-emerald-500"
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Simpan Susunan Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 3: PRIMARY FILE SOURCE SELECTION COMPONENT */}
        {adminSectionTab === 'source' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-violet-50/80 border border-violet-100 text-[#0f2d52] p-5 rounded-2xl text-xs space-y-2 flex items-start gap-3.5">
              <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <Server className="w-5 h-5 text-violet-700 shrink-0" />
              </div>
              <div>
                <p className="font-extrabold text-violet-950 text-sm">Kawalan Punca &amp; Sumber Fail (Primary File Source)</p>
                <p className="text-slate-500 leading-relaxed font-semibold">
                  Pilih saluran punca data utama bagi operasi storan dokumen. Ini membolehkan peralihan tanpa henti sekiranya skop Google OAuth atau had quota API berubah di sisi Cloud Server.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Local Storage Option Card */}
              <div 
                onClick={() => handleSaveSourceConfig('local_storage')}
                className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex items-start space-x-4 ${
                  primaryFileSource === 'local_storage' 
                    ? 'border-indigo-600 bg-indigo-50/20' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-2xl border ${primaryFileSource === 'local_storage' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    Mod Simpanan Tempatan &amp; Google drive
                    {primaryFileSource === 'local_storage' && <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">TERPILIH</span>}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">Storan utama disegerakkan serta-merta menggunakan Google Cloud Firestore. Sangat lancar, responsif tinggi dan menyokong dwi-mod google drive secara back-end silang.</p>
                </div>
              </div>

              {/* Direct Drive Option Card */}
              <div 
                onClick={() => handleSaveSourceConfig('direct_drive')}
                className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex items-start space-x-4 ${
                  primaryFileSource === 'direct_drive' 
                    ? 'border-indigo-600 bg-indigo-50/20' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-2xl border ${primaryFileSource === 'direct_drive' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  <HardDrive className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    Mod Storan Terus Google API (OAuth)
                    {primaryFileSource === 'direct_drive' && <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">TERPILIH</span>}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">Storan utama dihubungkan terus ke Google Drive Cloud API menggunakan fail pelayaran rasmi. Pilihan alternatif berskala besar.</p>
                </div>
              </div>

            </div>

            <div className="pt-4 flex justify-between items-center border-t border-slate-100 text-xs">
              {sourceSaveSuccess ? (
                <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1 animate-pulse bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                  <Check className="w-4 h-4" /> Punca fail ditukar secara masa-nyata!
                </span>
              ) : (
                <span className="text-slate-400 font-semibold">Tukar konfigurasi data dwi-mod mengikut kesesuaian kestabilan platform.</span>
              )}
            </div>
          </div>
        )}

        {/* MODULE 4: REGISTERED USER EMAILS ONLY */}
        {adminSectionTab === 'roles' && (
          <div className="space-y-7 animate-in fade-in duration-300">
            <div className="bg-rose-50/80 border border-rose-100 text-[#0f2d52] p-5 rounded-2xl text-xs space-y-2 flex items-start gap-3.5">
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-rose-700 shrink-0" />
              </div>
              <div>
                <p className="font-extrabold text-rose-950 text-sm">Sistem Kebenaran Kemasukan E-mel Berdaftar</p>
                <p className="text-slate-500 leading-relaxed font-semibold">
                  Akses log masuk kini dikawal sepenuhnya menggunakan senarai email berdaftar. Hanya alamat email yang tersenarai secara rasmi di bawah sahaja dibenarkan log masuk ke dalam Dashboard. Pengguna tidak berdaftar akan disekat serta-merta.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Add form card */}
              <div id="add-role-panel" className="bg-slate-50 border border-slate-200/50 p-6 rounded-3xl space-y-4">
                <h4 className="text-xs font-black text-[#0A192F] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200/50">
                  <Plus className="w-4 h-4 text-[#1565C0]" />
                  Daftarkan Alamat E-mel Baru
                </h4>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alamat E-mel Google/Gmail:</label>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#1565C0] transition-all text-slate-800"
                  />
                </div>

                {roleSaveSuccess && (
                  <p className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md font-bold text-center border border-emerald-200 animate-pulse">
                    ✓ Alamat email berjaya didaftarkan ke dalam sistem.
                  </p>
                )}

                <button
                  onClick={handleAddRegisteredEmail}
                  className="w-full py-2.5 bg-[#1565C0] hover:bg-[#0F2D52] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#1b2f4a]"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Daftar Email
                </button>
              </div>

              {/* Roles listing */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h4 className="text-xs font-black text-[#0A192F] uppercase tracking-wider block flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Senarai Email Berdaftar (Kebenaran Masuk)
                  </h4>
                  <div className="relative w-full sm:w-56 shrink-0">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Cari e-mel..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-3xl overflow-hidden divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                  
                  {/* Super admin predefined entry always shown */}
                  <div className="grid grid-cols-12 p-3 items-center bg-slate-50/50">
                    <div className="col-span-8 sm:col-span-6 flex items-center gap-2">
                      <div className="w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">SA</div>
                      <div className="truncate">
                        <p className="font-bold text-slate-700 truncate text-[11px] leading-tight">Pengasas Utama (Sistem)</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate select-all">syahrulxy91@gmail.com</p>
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-4 flex justify-center gap-1">
                      <span className="text-[9px] bg-red-50 text-red-600 font-black px-1.5 py-0.5 rounded-md border border-red-200 uppercase">SUPER ADMIN (UTAMA)</span>
                    </div>
                    <div className="col-span-12 sm:col-span-2 flex justify-end gap-1 font-mono text-[9px] text-slate-400 font-bold pr-3">
                      Kekal
                    </div>
                  </div>

                  {/* Other assignments listed in real-time */}
                  {Object.keys(registeredEmails).map((emailKey) => {
                    if (emailKey.toLowerCase() === 'syahrulxy91@gmail.com') return null;
                    if (searchQuery && !emailKey.toLowerCase().includes(searchQuery.toLowerCase())) return null;
                    const data = registeredEmails[emailKey];
                    return (
                      <div key={emailKey} className="grid grid-cols-12 p-3 items-center hover:bg-slate-50/50">
                        <div className="col-span-8 sm:col-span-6 flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-extrabold text-[10px] shrink-0 font-mono">{emailKey[0].toUpperCase()}</div>
                          <div className="truncate">
                            <p className="text-[11px] font-bold text-slate-700 truncate select-all">{emailKey}</p>
                            <p className="text-[9px] text-slate-400 truncate flex items-center gap-1">
                              Daftar: {data.createdAt ? new Date(data.createdAt).toLocaleDateString('ms-MY') : 'Tiada Tarikh'}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-4 sm:col-span-4 flex flex-wrap justify-center gap-1">
                          <span className="text-[9px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-md border border-green-200 uppercase">PENGGUNA SAH</span>
                        </div>
                        <div className="col-span-12 sm:col-span-2 flex justify-end gap-1 my-1 sm:my-0 pr-2">
                          <button
                            onClick={() => handleRemoveRegisteredEmail(emailKey)}
                            className="p-1 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1"
                            title="Padam"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Logged In list showing who is registered / who is blocked */}
                  {filteredUsers.map((userObj: any) => {
                    const lowerEmail = userObj.email.toLowerCase();
                    if (registeredEmails[lowerEmail] || lowerEmail === 'syahrulxy91@gmail.com') return null;
                    return (
                      <div key={userObj.uid || userObj.email} className="grid grid-cols-12 p-3 items-center hover:bg-slate-50/50">
                        <div className="col-span-8 sm:col-span-6 flex items-center gap-2">
                          {userObj.photoURL ? (
                            <img src={userObj.photoURL} alt="p" className="w-6 h-6 rounded-xl shrink-0" />
                          ) : (
                            <div className="w-6 h-6 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">{userObj.name?.[0] || 'U'}</div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-slate-700 truncate text-[11px] leading-tight">{userObj.name || 'User'}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate select-all">{lowerEmail}</p>
                          </div>
                        </div>
                        <div className="col-span-4 sm:col-span-4 flex justify-center gap-1">
                          <span className="text-[9px] bg-red-50 text-red-600 font-extrabold px-1.5 py-0.5 rounded border border-red-200 uppercase">BELUM BERDAFTAR</span>
                        </div>
                        <div className="col-span-12 sm:col-span-2 flex justify-end gap-1 mt-2 sm:mt-0 pr-2">
                          <button
                            onClick={() => {
                              setNewEmail(lowerEmail);
                            }}
                            className="px-2 py-1 text-emerald-600 hover:text-emerald-700 bg-white border border-slate-200 hover:border-emerald-200 rounded-lg text-[10px] font-extrabold"
                          >
                            Pilih E-mel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

interface KPIBoxProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend: string;
  color: 'indigo' | 'emerald' | 'rose' | 'violet' | 'amber';
}

function KPIBox({ title, value, icon, trend, color }: KPIBoxProps) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50/70', border: 'hover:border-indigo-500/20', text: 'text-indigo-600', trend: 'text-indigo-500' },
    emerald: { bg: 'bg-emerald-50/70', border: 'hover:border-emerald-500/20', text: 'text-emerald-600', trend: 'text-emerald-500' },
    rose: { bg: 'bg-rose-50/70', border: 'hover:border-rose-500/20', text: 'text-rose-600', trend: 'text-rose-500' },
    violet: { bg: 'bg-violet-50/70', border: 'hover:border-violet-500/20', text: 'text-violet-600', trend: 'text-violet-500' },
    amber: { bg: 'bg-amber-50/70', border: 'hover:border-amber-500/20', text: 'text-amber-600', trend: 'text-amber-500' }
  };

  const choice = colorMap[color] || colorMap.indigo;

  return (
    <div className={`bg-white p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center hover:scale-[1.01] hover:shadow-md transition-all text-center ${choice.border}`}>
      <div className="flex flex-col items-center gap-3 w-full mb-4">
        <div className={`p-3.5 ${choice.bg} rounded-2xl flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <span className={`text-xs font-semibold ${choice.trend} bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100`}>
          {trend}
        </span>
      </div>
      <div>
        <h3 className="text-xs sm:text-sm text-slate-400 font-medium uppercase tracking-widest leading-normal mb-2">{title}</h3>
        <p className="text-4xl font-black text-slate-800 tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}
