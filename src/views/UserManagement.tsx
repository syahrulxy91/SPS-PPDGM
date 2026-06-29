import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  where,
  getDocs 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { getCurrentAppUser } from '../lib/auth';
import { 
  Users, 
  ShieldAlert, 
  Search, 
  Filter, 
  UserX, 
  UserCheck, 
  Shield, 
  CheckCircle2, 
  Clock, 
  ArrowLeftRight, 
  RefreshCw,
  ExternalLink,
  History,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CLOUD_FUNCTIONS_BASE_URL = (import.meta as any).env?.VITE_CLOUD_FUNCTIONS_URL || 'https://us-central1-spsppdgm.cloudfunctions.net';

interface SystemUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  disabled?: boolean;
  lastLogin?: any;
  updatedAt?: any;
  updatedBy?: string;
}

interface SecurityLog {
  id: string;
  eventType: string;
  performedBy: string;
  targetUser: string;
  oldRole?: string;
  newRole?: string;
  timestamp: any;
  status: string;
}

export default function UserManagement() {
  const currentUser = getCurrentAppUser();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.email?.toLowerCase() === 'syahrulxy91@gmail.com';

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Operations State
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newSelectedRole, setNewSelectedRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'USER'>('USER');

  // Verify access
  if (!isSuperAdmin) {
    return (
      <div id="access-denied-container" className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-100 shadow-md mb-6 animate-bounce">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Akses Ditolak (403)</h2>
        <p className="text-slate-500 text-sm max-w-md mt-2 leading-relaxed">
          Sistem mengesan cubaan akses tanpa kebenaran. Modul Pengurusan Pengguna (RBAC) hanya dibenarkan untuk kegunaan Super Pentadbir sahaja.
        </p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition duration-200 shadow-sm"
        >
          Kembali ke Paparan Utama
        </button>
      </div>
    );
  }

  // Load users from Firestore
  useEffect(() => {
    setLoading(true);
    const usersRef = collection(db, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: SystemUser[] = [];
      snapshot.forEach((doc) => {
        usersList.push(doc.data() as SystemUser);
      });
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error('Ralat melayari users:', error);
      setErrorMessage('Gagal memuatkan senarai pengguna dari Firestore. Sila periksa Firestore Security Rules.');
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  // Load security logs
  useEffect(() => {
    if (activeTab !== 'logs') return;
    setLogsLoading(true);
    const logsRef = collection(db, 'securityLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsList: SecurityLog[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() } as SecurityLog);
      });
      setSecurityLogs(logsList);
      setLogsLoading(false);
    }, (error) => {
      console.error('Ralat melayari security logs:', error);
      setLogsLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'securityLogs');
    });

    return () => unsubscribe();
  }, [activeTab]);

  // Execute Cloud Function for user claim / status changes
  const handleUserOperation = async (payload: { action: string; targetUid: string; role?: string; disabled?: boolean }) => {
    if (!auth.currentUser) return;
    setProcessingUid(payload.targetUid);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/manageUsers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      const result = await response.json();
      setSuccessMessage(result.message || 'Operasi berjaya dilaksanakan.');
      
      // If updating oneself, trigger token refresh on auth client
      if (payload.targetUid === auth.currentUser.uid) {
        await auth.currentUser.getIdToken(true);
        // Alert user that their own role changed
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Ralat operasi pengguna:', err);
      setErrorMessage(err.message || 'Gagal melaksanakan perubahan peranan/status.');
    } finally {
      setProcessingUid(null);
    }
  };

  const openRoleModal = (user: SystemUser) => {
    setSelectedUser(user);
    setNewSelectedRole(user.role);
    setShowRoleModal(true);
  };

  const submitRoleChange = async () => {
    if (!selectedUser) return;
    setShowRoleModal(false);
    await handleUserOperation({
      action: 'changeRole',
      targetUid: selectedUser.uid,
      role: newSelectedRole
    });
  };

  const toggleUserStatus = async (user: SystemUser) => {
    const isCurrentlyDisabled = !!user.disabled;
    const confirmMsg = isCurrentlyDisabled 
      ? `Adakah anda pasti mahu mengaktifkan semula akaun ${user.email}?`
      : `Adakah anda pasti mahu menyahaktifkan akaun ${user.email}? Pengguna ini tidak akan dapat log masuk ke dalam sistem.`;

    if (window.confirm(confirmMsg)) {
      await handleUserOperation({
        action: 'setDisabled',
        targetUid: user.uid,
        disabled: !isCurrentlyDisabled
      });
    }
  };

  // Filter & Search users
  const filteredUsers = users.filter(u => {
    const nameLower = (u.name || '').toLowerCase();
    const emailLower = (u.email || '').toLowerCase();
    const searchLower = searchQuery.toLowerCase().trim();
    
    const matchesSearch = nameLower.includes(searchLower) || emailLower.includes(searchLower);
    
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    
    const isUserDisabled = !!u.disabled;
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'ENABLED' && !isUserDisabled) || 
      (statusFilter === 'DISABLED' && isUserDisabled);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'USER':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Pentadbir (Admin)';
      case 'USER':
      default:
        return 'Pengguna Biasa';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Pengurusan Pengguna (RBAC)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Urus peranan kebenaran sistem, status akaun, dan pantau rekod keselamatan custom claims.
          </p>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mt-4 md:mt-0 gap-1 select-none">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === 'users' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Senarai Kakitangan ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'logs' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Log Keselamatan
          </button>
        </div>
      </div>

      {/* Alert states */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2.5 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center gap-2.5 shadow-sm"
          >
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'users' ? (
        <>
          {/* Filters section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4">
            {/* Search input */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, e-mel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 text-slate-800 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Filter selectors */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">Peranan:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">Semua Peranan</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Pentadbir (Admin)</option>
                  <option value="USER">Pengguna Biasa</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ENABLED">Aktif (Enabled)</option>
                  <option value="DISABLED">Nyahaktif (Disabled)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users List Container */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-slate-500 text-sm font-semibold">Memuatkan data pengguna...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Tiada Pengguna Ditemui</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
                Tiada rekod pengguna yang sepadan dengan parameter carian atau penapis anda buat masa ini.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Kakitangan / Pengguna</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sistem ID (UID)</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Peranan (Role)</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Log Masuk Akhir</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const isSelf = u.uid === currentUser?.uid;
                      const isUserDisabled = !!u.disabled;

                      return (
                        <tr key={u.uid} className={`hover:bg-slate-50/50 transition ${isUserDisabled ? 'opacity-65 bg-slate-50/20' : ''}`}>
                          {/* Name & Photo */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {u.photoURL ? (
                                <img 
                                  src={u.photoURL} 
                                  alt={u.name} 
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold uppercase shrink-0 ring-2 ring-slate-100">
                                  {u.name?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div>
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                  {u.name}
                                  {isSelf && (
                                    <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-black uppercase">
                                      Saya
                                    </span>
                                  )}
                                </h4>
                                <span className="text-xs text-slate-400 font-medium">{u.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* UID */}
                          <td className="p-4 font-mono text-xs text-slate-400 select-all">
                            {u.uid}
                          </td>

                          {/* Role */}
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border ${getRoleBadgeColor(u.role)}`}>
                              <Shield className="w-3.5 h-3.5" />
                              {getRoleLabel(u.role)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            {isUserDisabled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black tracking-wide bg-rose-50 text-rose-700 border border-rose-100 rounded-full uppercase">
                                Nyahaktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full uppercase">
                                Aktif
                              </span>
                            )}
                          </td>

                          {/* Last Login */}
                          <td className="p-4 text-xs text-slate-500 font-medium">
                            {u.lastLogin ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {typeof u.lastLogin?.toDate === 'function'
                                    ? u.lastLogin.toDate().toLocaleString('ms-MY')
                                    : new Date(u.lastLogin).toLocaleString('ms-MY')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic">Belum dikesan</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Change Role Button */}
                              <button
                                disabled={processingUid !== null}
                                onClick={() => openRoleModal(u)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-200 hover:text-slate-800 transition flex items-center gap-1 disabled:opacity-50"
                                title="Kemas kini peranan Custom Claims"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                Tukar Role
                              </button>

                              {/* Disable / Enable Button */}
                              {!isSelf ? (
                                <button
                                  disabled={processingUid !== null}
                                  onClick={() => toggleUserStatus(u)}
                                  className={`p-1.5 rounded-xl border transition ${
                                    isUserDisabled 
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                                      : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                  }`}
                                  title={isUserDisabled ? 'Aktifkan semula pengguna' : 'Nyahaktifkan pengguna'}
                                >
                                  {isUserDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                </button>
                              ) : (
                                <div className="w-7"></div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Security Logs Table */
        <>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 mb-6">
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              SPS Audit Trail: Rekod Custom Claims & Keselamatan
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              Rekod log keselamatan sistem secara automatik mencatat semua aktiviti pertukaran peranan (claims) dan nyahaktif pengguna.
            </p>
          </div>

          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-slate-500 text-sm font-semibold">Memuatkan rekod log keselamatan...</p>
            </div>
          ) : securityLogs.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Tiada Rekod Keselamatan</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
                Tiada ralat, pertukaran, atau log perubahan claims yang direkodkan dalam pangkalan data setakat ini.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acara Keselamatan</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pelaku (Super Admin)</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pengguna Sasaran (Target)</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Perubahan Peranan</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tarikh / Masa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {securityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/30 transition">
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                            log.eventType === 'ROLE_CHANGED' 
                              ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                              : log.eventType === 'USER_DISABLED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {log.eventType}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-700">{log.performedBy}</td>
                        <td className="p-4 text-sm text-slate-600 font-medium">{log.targetUser}</td>
                        <td className="p-4 text-xs font-semibold">
                          {log.eventType === 'ROLE_CHANGED' ? (
                            <span className="text-slate-500 flex items-center gap-1">
                              <span className="font-bold text-slate-400">{log.oldRole || 'USER'}</span>
                              <span>&rarr;</span>
                              <span className="font-bold text-indigo-600">{log.newRole}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {log.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-400 font-medium">
                          {log.timestamp ? (
                            typeof log.timestamp?.toDate === 'function'
                              ? log.timestamp.toDate().toLocaleString('ms-MY')
                              : new Date(log.timestamp).toLocaleString('ms-MY')
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Role Change Modal */}
      <AnimatePresence>
        {showRoleModal && selectedUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-100 max-w-md w-full shadow-2xl p-6 font-sans overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Tukar Peranan Pengguna</h3>
                  <p className="text-slate-400 text-xs">Peta custom user claims Firebase secara rasmi.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Selected user profile summary */}
                <div className="bg-slate-50 p-3.5 rounded-2xl flex items-center gap-3">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold">{selectedUser.name?.charAt(0)}</div>
                  )}
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{selectedUser.name}</h4>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Role selection dropdown */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Pilih Peranan Baharu</label>
                  <select
                    value={newSelectedRole}
                    onChange={(e) => setNewSelectedRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-bold focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="USER">Pengguna Biasa (Sewa, Upload, Lihat)</option>
                    <option value="ADMIN">Pentadbir / Admin (Dashboard, Delete, Google Drive)</option>
                    <option value="SUPER_ADMIN">Super Admin (Akses Penuh / Semua kebenaran)</option>
                  </select>
                </div>

                <div className="p-3 bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-800 rounded-xl leading-relaxed font-semibold">
                  * Ambil perhatian: Kemas kini custom claims akan dipetakan ke atas token ID auth pengguna. Token akan disegerakan pada penyegaran token seterusnya atau apabila pengguna log masuk semula.
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition border border-slate-200"
                >
                  Batal
                </button>
                <button
                  onClick={submitRoleChange}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
                >
                  Sahkan &amp; Kemas kini
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
