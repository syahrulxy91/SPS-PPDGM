import React, { useState, useEffect } from 'react';
import { googleSignIn, getCurrentAppUser, logout } from '../lib/auth';
import { resetDriveFoldersCache } from '../lib/drive';
import { getGoogleDriveConfigSync, saveGoogleDriveConfig, fetchGoogleDriveConfig } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, Folder, ShieldAlert, Save, CheckCircle, X, Lock, AlertTriangle, Shield, LogOut, RefreshCw 
} from 'lucide-react';

// Lokasi imej latar belakang utama (Disimpan dalam src/public/bg/login-bg.png)
const BG_IMAGE_PATH = '/bg/login-bg.png';

/**
 * Menghalang sambungan Firestore daripada tergantung terlalu lama semasa operasi menulis
 * jika rangkaian tersekat atau peranti berada di luar talian (offline).
 * 
 * NOTA KESELAMATAN & KOORDINASI MAINTAINER:
 * - Operasi timeout ini dianggap sebagai KEGAGALAN rangkaian atau Firestore (bukan kejayaan).
 * - Sebarang pengendalian bagi storan peranti setempat (local-first save/cache sync) perlu
 *   diuruskan secara berasingan di peringkat lapisan pemanggil, bukan di dalam helper abstrak ini.
 */
function withWriteTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 3000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(
        `SAMBUNGAN TERGENDALA: Panggilan Firestore melebihi had masa (${timeoutMs} ms).`
      );
      reject(new Error(`Firestore write timeout after ${timeoutMs} ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Local session state to track currently logged-in user in real-time
  const [sessionUser, setSessionUser] = useState(() => getCurrentAppUser());

  // Super Admin Control Center modal states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  
  // Centralized Google Drive Configuration state
  const [googleDriveConfig, setGoogleDriveConfig] = useState(() => getGoogleDriveConfigSync());

  useEffect(() => {
    if (isAdminModalOpen) {
      fetchGoogleDriveConfig()
        .then(config => {
          setGoogleDriveConfig(config);
          if (config.unitFolders) {
            setUnitFolders(config.unitFolders);
          }
        })
        .catch((err) => {
          console.warn('[FIRESTORE] Gagal memuatkan konfigurasi Google Drive dari panel Super Admin:', err);
        });
    }
  }, [isAdminModalOpen]);
  
  const [unitFolders, setUnitFolders] = useState<Record<string, string>>(() => {
    const config = getGoogleDriveConfigSync();
    if (config && config.unitFolders && Object.keys(config.unitFolders).length > 0) {
      return config.unitFolders;
    }
    const custom = localStorage.getItem('sps_drive_unit_folders');
    if (custom) {
      try {
        return JSON.parse(custom);
      } catch (e) {
        // ignore
      }
    }
    return {
      'UNIT PRASEKOLAH': 'UNIT_PRASEKOLAH',
      'UNIT RENDAH': 'UNIT_RENDAH',
      'UNIT MENENGAH & TINGKATAN 6': 'UNIT_MENENGAH',
      'UNIT SWASTA': 'UNIT_SWASTA',
      'UNIT SIP+': 'SIP',
      'RUJUKAN_BERSAMA': 'RUJUKAN_BERSAMA'
    };
  });

  // Status flags
  const [driveSaveSuccess, setDriveSaveSuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setAuthError(null);
      const res = await googleSignIn();
      if (res) {
        setSessionUser(getCurrentAppUser());
        navigate('/dashboard');
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(e?.message || String(e));
    }
  };

  // Google Sign-In strictly from within the Super Admin Panel for verification
  const handleAdminVerifyLogin = async () => {
    try {
      setVerifyError(null);
      setVerifying(true);
      const res = await googleSignIn();
      if (res) {
        const user = getCurrentAppUser();
        setSessionUser(user);
      }
    } catch (e: any) {
      console.error(e);
      setVerifyError(e?.message || 'Gagal log masuk Google Auth. Sila cuba lagi.');
    } finally {
      setVerifying(false);
    }
  };

  const handleAdminLogout = async () => {
    await logout();
    setSessionUser(null);
  };

  const saveDriveConfig = async () => {
    const updatedByEmail = sessionUser?.email || 'syahrulxy91@gmail.com';
    const configToSave = {
      googleDriveEnabled: googleDriveConfig.googleDriveEnabled,
      googleDriveRootFolderId: googleDriveConfig.googleDriveRootFolderId,
      unitFolders: unitFolders,
      updatedBy: updatedByEmail
    };

    try {
      await withWriteTimeout(saveGoogleDriveConfig(configToSave));
      setGoogleDriveConfig(configToSave);
      localStorage.setItem('sps_drive_root_folder', configToSave.googleDriveRootFolderId);
      localStorage.setItem('sps_drive_unit_folders', JSON.stringify(unitFolders));
      resetDriveFoldersCache();
      setDriveSaveSuccess(true);
      setTimeout(() => setDriveSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
      alert('Gagal menyelaraskan konfigurasi Google Drive ke Firestore Pelayan.');
    }
  };

  // Determine if the logged-in session email has Super Admin credentials
  const currentEmailLower = sessionUser?.email ? sessionUser.email.toLowerCase() : '';
  const isAuthorizedSuperAdmin = 
    sessionUser?.role === 'SUPER_ADMIN' || currentEmailLower === 'syahrulxy91@gmail.com';

  return (
    <div 
      className="min-h-screen w-full flex flex-col text-slate-100 font-sans selection:bg-indigo-600 selection:text-white bg-gradient-to-tr from-slate-950 via-[#0A192F] to-[#121B2E] relative"
      style={{
        backgroundImage: `url('${BG_IMAGE_PATH}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <header className="h-16 flex-none bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <img 
            src="/icons/android-chrome-192x192.png" 
            alt="Logo SPS" 
            className="w-14 h-14 object-contain" 
          />
          <div>
            <h1 className="text-[#0F2D52] font-bold text-lg leading-tight tracking-tight">E -LAPORAN SPS</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider">PEJABAT PENDIDIKAN DAERAH GUA MUSANG</p>
          </div>
        </div>
        
        {/* MODIFIED: Changed "Log Masuk Pegawai" button to Gear Settings Icon for Super Admin Only */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block h-8 w-[1px] bg-slate-200 mx-2"></div>
          <button 
            onClick={() => setIsAdminModalOpen(true)}
            className="flex items-center justify-center p-2.5 bg-white border border-slate-300 rounded-full shadow-sm hover:bg-slate-50 hover:text-[#1565C0] hover:border-[#1565C0]/40 transition-all text-slate-600 cursor-pointer"
            title="Super Admin Panel (Akses Konfigurasi)"
          >
            <Settings className="w-5 h-5 animate-[spin_8s_linear_infinite]" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto w-full z-10 my-auto">
        <motion.div 
          className="bg-white/95 backdrop-blur-md p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200/60 max-w-lg w-full flex flex-col items-center text-center space-y-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <img 
            src="/icons/android-chrome-512x512.png" 
            alt="Logo SPS" 
            className="w-32 h-32 object-contain" 
          />

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F2D52] leading-tight tracking-tight">
              Sektor Pengurusan <span className="text-[#1565C0]">Sekolah</span>
            </h2>
            <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">
              Pejabat Pendidikan Daerah Gua Musang
            </p>
          </div>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed text-balance">
            Sistem e-Laporan berpusat untuk menyimpan, mengurus dan mengakses dokumen secara sistematik, berkualiti, dan selamat.
          </p>

          <div className="w-full h-[1px] bg-slate-200/80"></div>

          <div className="w-full flex flex-col items-center gap-4">
            <button 
              onClick={handleLogin}
              className="flex items-center justify-center gap-3 w-full py-3.5 bg-[#0F2D52] hover:bg-[#1565C0] text-white rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 font-bold text-sm sm:text-base border border-slate-800"
            >
              <svg className="w-5.5 h-5.5 bg-white rounded-full p-1" viewBox="0 0 24 24">
                 <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                 <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              </svg>
              Log Masuk dengan Google
            </button>

            {authError && (
              <div id="auth-error-alert" className="bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl p-4 text-left space-y-3 w-full">
                {authError.includes('unauthorized-domain') ? (
                  <>
                    <h4 className="font-bold font-sans text-[#0f2d52] flex items-center gap-1.5 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                      Domain Belum Dibenarkan (Unauthorized Domain)
                    </h4>
                    <p className="leading-relaxed text-slate-700">
                      Firebase memerlukan pihak pentadbir untuk mendaftarkan domain aplikasi ini di Firebase Console agar log masuk pihak ketiga (Google) berfungsi.
                    </p>
                    <div className="bg-white border border-red-200 rounded-lg p-2.5 space-y-2">
                      <p className="font-semibold text-slate-800 text-[11px]">Sila salin dan tambah domain berikut:</p>
                      <div className="space-y-1.5 font-mono text-[10px] break-all select-all bg-slate-50 p-2 rounded border border-slate-100 text-slate-800">
                        <div>1. <span className="font-bold underline text-blue-700">{window.location.hostname}</span></div>
                        <div>2. <span className="font-bold underline text-blue-700">{window.location.hostname.replace('-dev-', '-pre-')}</span></div>
                      </div>
                    </div>
                  </>
                ) : authError.includes('@moe.gov.my') ? (
                  <>
                    <h4 className="font-extrabold font-sans text-red-950 flex items-center gap-1.5 text-sm">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Akses Disekat
                    </h4>
                    <p className="leading-relaxed font-semibold text-red-900">
                      Hanya pengguna dengan email @moe.gov.my dibenarkan mengakses sistem ini.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold font-sans text-red-950">Ralat Log Masuk</p>
                    <p className="leading-relaxed font-sans text-slate-700">{authError}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </main>

      <footer className="h-auto sm:h-10 flex-none bg-[#0F2D52] text-white/60 p-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-[10px] tracking-wide mt-auto">
        <div className="text-center sm:text-left mb-2 sm:mb-0">&copy; {new Date().getFullYear()} Sektor Pengurusan Sekolah (SPS) | Pejabat Pendidikan Daerah. Hak Cipta Terpelihara.</div>
        <div className="flex items-center gap-4">
          <span>PENTADBIR SISTEM</span>
          <span className="hidden sm:inline-block h-3 w-[1px] bg-white/20"></span>
          <span className="text-white/40">Versi 2.1.0-Enterprise</span>
        </div>
      </footer>

      {/* Super Admin Control Center Modal overlay */}
      <AnimatePresence>
        {isAdminModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-[#0F2D52] text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl border border-white/10">
                    <Shield className="w-5 h-5 text-[#FBC02D]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight sm:text-lg">Super Admin Control Center</h3>
                    <p className="text-[10px] text-white/70">Sektor Pengurusan Sekolah (Gua Musang)</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAdminModalOpen(false);
                    setVerifyError(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!sessionUser ? (
                /* SCREEN 1: User not logged in */
                <div className="p-6 sm:p-10 text-center flex flex-col items-center space-y-6">
                  <div className="w-16 h-16 bg-blue-50 text-[#1565C0] rounded-full flex items-center justify-center border border-blue-100">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h4 className="text-xl font-bold text-slate-800">Akses Pengesahan Pentadbir</h4>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                      Laman tetapan ini disekat dan dikunci secara ketat. Sila log masuk dengan akaun Google yang dibenarkan untuk teruskan.
                    </p>
                  </div>

                  <div className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-red-700">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Had Akses Super Admin:
                    </div>
                    <p>
                      Mempunyai akaun Google aktif dengan e-mel rasmi <strong className="text-slate-800 select-all">syahrulxy91@gmail.com</strong> (atau akaun pembangun yang diiktiraf). Akaun luar tidak akan dibenarkan mengakses tetapan backend.
                    </p>
                  </div>

                  <button
                    onClick={handleAdminVerifyLogin}
                    disabled={verifying}
                    className="w-full max-w-xs flex items-center justify-center gap-3 py-3 bg-[#0F2D52] hover:bg-[#1565C0] text-white rounded-xl shadow-md font-bold text-sm transition-all transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4.5 h-4.5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      </svg>
                    )}
                    Verify Admin Credentials
                  </button>

                  {verifyError && (
                    <p className="text-xs text-red-600 font-semibold">{verifyError}</p>
                  )}
                </div>
              ) : !isAuthorizedSuperAdmin ? (
                /* SCREEN 2: User logged in but unauthorized */
                <div className="p-6 sm:p-10 text-center flex flex-col items-center space-y-6">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-100">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h4 className="text-xl font-bold text-red-900">Tiada Kebenaran Dinonaktifkan</h4>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                      Akaun Google anda <span className="font-bold text-slate-700 select-all">{sessionUser.email}</span> tidak mempunyai hak superadmin utama untuk mengubah sistem.
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left rounded-xl p-4 max-w-md">
                    Sila hubungi <strong className="text-slate-900">syahrulxy91@gmail.com</strong> untuk mengemukakan permohonan kebenaran peranan sebagai editor.
                  </div>

                  <div className="flex gap-3 w-full max-w-sm">
                    <button
                      onClick={handleAdminLogout}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Ziarah Akaun Lain (Logout)
                    </button>
                    <button
                      onClick={() => setIsAdminModalOpen(false)}
                      className="flex-1 py-2.5 bg-[#0F2D52] text-white hover:bg-[#1565C0] font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Batal Hubungan
                    </button>
                  </div>
                </div>
              ) : (
                /* SCREEN 3: Authorized Admin View (Drive configs & User roles) */
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                  {/* Admin User Toolbar */}
                  <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                      {sessionUser.photoURL ? (
                        <img src={sessionUser.photoURL} alt="Admin" className="w-7 h-7 rounded-full border border-[#1565C0]" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-7 h-7 bg-[#1565C0] text-white rounded-full flex items-center justify-center text-xs font-bold">SA</div>
                      )}
                      <div className="text-[11px] leading-tight">
                        <p className="text-slate-800 font-bold">{sessionUser.name}</p>
                        <p className="text-slate-500">{sessionUser.email}</p>
                      </div>
                      <span className="text-[8px] sm:text-[9px] bg-red-600 text-white font-bold tracking-wider px-1.5 py-0.5 rounded-full">SUPER ADMIN</span>
                    </div>

                    <button
                      onClick={handleAdminLogout}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>

                  {/* Operational Tabs */}
                  <div className="flex border-b border-slate-200 bg-white">
                    <div
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-extrabold border-b-2 border-[#1565C0] text-[#1565C0] bg-slate-50/20 cursor-default select-none"
                    >
                      <Folder className="w-4 h-4" />
                      Struktur Google Drive Folder
                    </div>
                  </div>

                  {/* Panel Details Container */}
                  <div className="p-6 overflow-y-auto max-h-[50vh] flex-1">
                      /* TAB 1: Drive Folder Settings */
                      <div className="space-y-5">
                        <div className="bg-blue-50/50 border border-blue-200 text-[#0F2D52] p-4 rounded-2xl text-xs space-y-1.5">
                          <p className="font-bold flex items-center gap-1">
                            <Folder className="w-4 h-4 text-[#1565C0]" />
                            Pengurusan Folder Google Drive Sektor
                          </p>
                          <p className="text-slate-600 tracking-wide">
                            Tetapkan nama folder akar (root) dan nama subfolder unit di bawah. Folder ini akan dibuat secara automatik di dalam akaun Google Drive pegawai yang menyerahkan laporan jika ia belum wujud.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                ID Root Folder Google Drive (Centralized):
                              </label>
                              <input
                                type="text"
                                value={googleDriveConfig.googleDriveRootFolderId}
                                onChange={(e) => setGoogleDriveConfig({
                                  ...googleDriveConfig,
                                  googleDriveRootFolderId: e.target.value
                                })}
                                placeholder="e.g. 1-Gdkrl8YiQ-pJzi_vSV940qDRv_9OEaH"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-1 focus:ring-[#1565C0] focus:border-[#1565C0] outline-none font-bold font-mono"
                              />
                              <p className="text-[10px] text-slate-400">Selesai diselaraskan dengan Firestore <span className="font-mono text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">systemSettings/googleDriveConfig</span></p>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="landingGoogleDriveEnabled"
                                checked={googleDriveConfig.googleDriveEnabled}
                                onChange={(e) => setGoogleDriveConfig({
                                  ...googleDriveConfig,
                                  googleDriveEnabled: e.target.checked
                                })}
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <label htmlFor="landingGoogleDriveEnabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                Aktifkan Penulisan Awan Google Drive (Dwi-Mod)
                              </label>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-snug">Diselia oleh: <span className="font-mono text-slate-600">{googleDriveConfig.updatedBy}</span></p>
                          </div>

                          <div className="h-[1px] bg-slate-200 my-4"></div>

                          <h5 className="text-xs font-bold text-[#0F2D52] uppercase tracking-wider mb-2">Pautan Nama Folder Bagi Setiap Unit:</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { label: 'Unit Prasekolah', key: 'UNIT PRASEKOLAH' },
                              { label: 'Unit Rendah', key: 'UNIT RENDAH' },
                              { label: 'Unit Menengah & Tingkatan 6', key: 'UNIT MENENGAH & TINGKATAN 6' },
                              { label: 'Unit Swasta', key: 'UNIT SWASTA' },
                              { label: 'SIP+', key: 'UNIT SIP+' },
                              { label: 'Bahan Rujukan Bersama', key: 'RUJUKAN_BERSAMA' }
                            ].map((unitItem) => (
                              <div key={unitItem.key} className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-600">{unitItem.label} ({unitItem.key}):</label>
                                <input
                                  type="text"
                                  value={unitFolders[unitItem.key] || ''}
                                  onChange={(e) => {
                                    setUnitFolders({
                                      ...unitFolders,
                                      [unitItem.key]: e.target.value
                                    });
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1565C0]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                          {driveSaveSuccess ? (
                            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-bounce">
                              <CheckCircle className="w-4 h-4" />
                              Konfigurasi folder disimpan & Cache di-clear!
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Semua perubahan disimpan ke dalam Local Engine pelayar.</span>
                          )}
                          <button
                            onClick={saveDriveConfig}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Simpan Konfigurasi
                          </button>
                        </div>
                      </div>
                  </div>

                  {/* Modal Footer actions */}
                  <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      Kawalan Sistem dijamin selamat (Google Auth 256-bit)
                    </div>
                    <button
                      onClick={() => setIsAdminModalOpen(false)}
                      className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Tutup Panel Kawalan
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

