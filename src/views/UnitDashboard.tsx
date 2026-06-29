import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  FileText, Plus, Search, Folder, Download, Eye, Share2, Trash2, 
  ChevronRight, Calendar, Layers, HardDrive, CheckCircle, X, UploadCloud, FileSpreadsheet, ArrowLeftRight, Clock
} from 'lucide-react';
import { readRows, appendRow } from '../lib/sheets';
import { initDriveFolders, uploadFileToDrive } from '../lib/drive';
import { getCurrentAppUser } from '../lib/auth';
import { getUnitDisplayName, getStandardUnitFromSlugOrTitle } from '../types';

const KATEGORI = ['Mesyuarat', 'Pemantauan', 'Data', 'Surat', 'Program', 'Taklimat', 'Pekeliling', 'SOP', 'Template', 'Laporan Khas', 'Lain-Lain'];

export default function UnitDashboard() {
  const { unitName } = useParams();
  const title = unitName?.split('-').join(' ').toUpperCase() || '';
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategoriTab, setSelectedKategoriTab] = useState<string>('Semua');

  // Stats
  const [totalDocs, setTotalDocs] = useState(0);
  const [currentMonthDocs, setCurrentMonthDocs] = useState(0);
  
  const user = getCurrentAppUser();

  const loadData = async () => {
    setLoading(true);
    try {
      const laporan = await readRows('Laporan') || [];
      const header = laporan[0] || [];
      const rows = laporan.slice(1).map(row => {
        const obj: any = {};
        header.forEach((h: string, i: number) => { obj[h] = row[i]; });
        return obj;
      });

      const standardTitle = getStandardUnitFromSlugOrTitle(title);
      const unitData = rows.filter(r => getStandardUnitFromSlugOrTitle(r.unit) === standardTitle).reverse();
      setData(unitData);

      const now = new Date();
      const cm = (now.getMonth() + 1).toString().padStart(2, '0');
      const cy = now.getFullYear().toString();

      setTotalDocs(unitData.length);
      setCurrentMonthDocs(unitData.filter(d => d.tahun === cy && d.bulan === cm).length);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelectedKategoriTab('Semua');
  }, [title]);

  const handleUploadComplete = () => {
    setShowUpload(false);
    loadData();
  };

  const filteredData = data.filter(doc => {
    const matchesSearch = 
      doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.kategori?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.keterangan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.uploadedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedKategoriTab === 'Semua' || doc.kategori === selectedKategoriTab;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Unit Header Redesign */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span>Sektor Pengurusan Sekolah</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="text-indigo-600 font-black">Laporan Unit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
            {getUnitDisplayName(getStandardUnitFromSlugOrTitle(title))}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">
            Urus arkib penyerahan fail rasmi, semak log kemas kini, dan hantar laporan unit dengan mudah.
          </p>
        </div>
        
        <button 
          onClick={() => setShowUpload(true)}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-600/15 border border-indigo-500 transition-all cursor-pointer hover:scale-[1.02]"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>Tambah Laporan Unit</span>
        </button>
      </div>

      {/* Stats Redesign */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatBox label="Jumlah Keseluruhan Fail" value={totalDocs} icon={<Folder className="text-indigo-500 w-5 h-5" />} description="Arkib terkumpul unit" />
        <StatBox label="Dokumen Bulan Ini" value={currentMonthDocs} icon={<Calendar className="text-emerald-500 w-5 h-5" />} description="Penyerahan kitaran semasa" />
        <StatBox label="Kategori Digunakan" value={new Set(data.map(d => d.kategori)).size} icon={<Layers className="text-rose-500 w-5 h-5" />} description="Segmen pengurusan fail" />
      </div>

      {/* Categories Horizontal Tabs Selector */}
      <div className="flex-1 w-full overflow-x-auto pb-1.5 scrollbar-thin">
        <div className="flex gap-2.5 p-1.5 bg-slate-100 rounded-2xl min-w-max border border-slate-200/50">
          <button
            onClick={() => setSelectedKategoriTab('Semua')}
            className={`px-6 py-3 rounded-xl text-xs sm:text-sm transition-all cursor-pointer ${
              selectedKategoriTab === 'Semua'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            Semua ({totalDocs})
          </button>
          {KATEGORI.map(k => {
            const count = data.filter(d => d.kategori === k).length;
            if (count === 0) return null; // Only show category tabs with files inside
            return (
              <button
                key={k}
                onClick={() => setSelectedKategoriTab(k)}
                className={`px-5.5 py-3 rounded-xl text-xs sm:text-sm transition-all cursor-pointer ${
                  selectedKategoriTab === k
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                {k} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Redesign */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden hover:border-indigo-500/10 transition-all">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/20">
          <div className="space-y-0.5">
            <h2 className="font-black text-slate-800 text-sm tracking-tight">Senarai Dokumen Rekod</h2>
            <p className="text-[11px] text-slate-400 font-medium">Laporan rasas diurus dalam kategori <span className="font-bold text-indigo-600">{selectedKategoriTab}</span></p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari kata kunci laporan..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
               <Clock className="w-8 h-8 text-indigo-500 animate-spin" />
               <span className="text-xs font-bold text-slate-500">Memuatkan baris dokumen fail...</span>
             </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-500 tracking-wider">
                  <th className="p-4 pl-6 font-extrabold">Nama Fail / Keterangan</th>
                  <th className="p-4 font-extrabold">Kategori</th>
                  <th className="p-4 font-extrabold">Kitaran Masa</th>
                  <th className="p-4 font-extrabold">Pemilik Laporan</th>
                  <th className="p-4 pr-6 font-extrabold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.length > 0 ? filteredData.map((doc, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center space-x-3 max-w-sm sm:max-w-md">
                        <div className="p-2 sm:p-2.5 bg-slate-100 rounded-xl border border-slate-200/40 text-indigo-500 shrink-0">
                          <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-700 text-xs sm:text-sm truncate" title={doc.name}>{doc.name}</div>
                          <div className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-1 font-medium">{doc.keterangan || 'Tiada info tambahan'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {doc.kategori}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-slate-600 font-bold font-mono">Bulan {doc.bulan || '00'} / {doc.tahun || '0000'}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {(() => {
                          if (!doc.uploadedAt) return 'Tiada tarikh';
                          const d = new Date(doc.uploadedAt);
                          return isNaN(d.getTime()) ? 'Tiada tarikh' : d.toLocaleDateString('ms-MY');
                        })()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-semibold text-slate-600 truncate max-w-[130px]" title={doc.uploadedBy}>{doc.uploadedBy}</div>
                      <div className="text-[9px] text-slate-400 font-mono scale-95 origin-left truncate max-w-[130px]">{doc.uploadedByEmail || 'sps@gmail.com'}</div>
                    </td>
                    <td className="p-4 pr-6 flex items-center justify-end space-x-2">
                      <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center space-x-1.5 text-xs bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 px-3 py-1.5 rounded-xl transition-all font-extrabold cursor-pointer hover:shadow-2xs">
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">Papar</span>
                      </a>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="p-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-300">
                          <Folder className="w-8 h-8" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 mt-2">Tiada Dokumen Dijumpai</p>
                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">Tiada rekod fail atau penyerahan berjaya dikesan di bawah kualiti filter ini.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showUpload && <UploadModal unitTitle={title} onClose={() => setShowUpload(false)} onComplete={handleUploadComplete} />}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}

function StatBox({ label, value, icon, description }: StatBoxProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-7 shadow-sm hover:border-indigo-500/20 transition-all flex flex-col items-center justify-center text-center space-y-4">
      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-400 font-medium uppercase tracking-widest leading-normal mb-1.5">{label}</div>
        <div className="text-4xl font-black text-slate-800 tracking-tight leading-none my-2">{value}</div>
        <div className="text-xs text-slate-400 font-normal leading-normal">{description}</div>
      </div>
    </div>
  );
}

function UploadModal({ unitTitle, onClose, onComplete }: { unitTitle: string, onClose: () => void, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '',
    kategori: 'Lain-Lain',
    keterangan: '',
    tahun: new Date().getFullYear().toString(),
    bulan: (new Date().getMonth() + 1).toString().padStart(2, '0')
  });

  const user = getCurrentAppUser();

  const validateFile = (f: File): { isValid: boolean; message: string } => {
    // Check size (20MB)
    if (f.size > 20 * 1024 * 1024) {
      return { isValid: false, message: "Saiz fail melebihi had maksimum 20MB." };
    }

    // Check extension
    const parts = f.name.split('.');
    if (parts.length < 2) {
      return { isValid: false, message: "Jenis fail tidak dibenarkan." };
    }
    const ext = parts[parts.length - 1].toLowerCase();

    const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'];
    const REJECTED_EXTS = ['exe', 'bat', 'cmd', 'apk', 'js', 'jar', 'msi', 'dll', 'ps1', 'zip', 'rar', '7z', 'iso', 'mp4', 'avi', 'mov'];

    if (REJECTED_EXTS.includes(ext) || !ALLOWED_EXTS.includes(ext)) {
      return { isValid: false, message: "Jenis fail tidak dibenarkan." };
    }

    // Check mime-type
    const mimeLower = (f.type || '').toLowerCase();
    const ALLOWED_MIMES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/pjpeg',
      'application/octet-stream'
    ];

    if (!ALLOWED_MIMES.includes(mimeLower)) {
      return { isValid: false, message: "Jenis fail tidak dibenarkan." };
    }

    return { isValid: true, message: "" };
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Sila pilih fail");

    const validation = validateFile(file);
    if (!validation.isValid) {
      return alert(validation.message);
    }

    setLoading(true);

    try {
      // Get the correct display name of the unit as expected by the backend whitelist mapping
      const unit = getStandardUnitFromSlugOrTitle(unitTitle);
      const uploaded = await uploadFileToDrive(file, unit);
      
      const newRow = [
        uploaded.id,
        form.name || file.name,
        form.kategori,
        form.keterangan,
        form.tahun,
        form.bulan,
        uploaded.url,
        uploaded.size.toString(),
        unit,
        new Date().toISOString(),
        user?.name || 'Sistem',
        user?.email || ''
      ];

      await appendRow('Laporan', newRow);

      // Audit Log
      await appendRow('Audit', [
        Date.now().toString(),
        new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[1].substring(0, 8),
        user?.name,
        user?.email,
        'Upload Dokumen: ' + (form.name || file.name),
        unitTitle
      ]);

      onComplete();
    } catch (err: any) {
      console.error(err);
      alert("Ralat semasa muat naik: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-slate-800 text-base">Muat Naik Laporan Baharu</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{unitTitle}</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleUpload} className="p-6 overflow-y-auto space-y-4 font-sans text-xs">
          
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-500 transition-all bg-slate-50/30 flex flex-col items-center">
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-[11px] font-extrabold text-slate-600 block">Pilih Fail Dokumen Laporan</span>
            <span className="text-[9px] text-slate-400 block mt-0.5 mb-3.5">PDF, Word, Excel, JPG atau PNG</span>
            <input 
              type="file" 
              required
              onChange={e => {
                const f = e.target.files?.[0] || null;
                if (f) {
                  const validation = validateFile(f);
                  if (!validation.isValid) {
                    alert(validation.message);
                    e.target.value = '';
                    setFile(null);
                    return;
                  }
                }
                setFile(f);
                if (f && !form.name) {
                  // Pre-fill name without extension
                  setForm(prev => ({ ...prev, name: f.name.replace(/\.[^/.]+$/, "") }));
                }
              }}
              className="w-full text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-slate-200 file:text-[10px] file:font-black file:bg-white file:text-indigo-600 hover:file:bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-[10px] cursor-pointer"
            />
            {file && (
              <span className="text-[10px] font-black text-emerald-600 mt-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Fail terpilih: {file.name}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Dokumen Laporan:</label>
            <input 
              type="text" 
              required
              placeholder="Contoh: Laporan Pemantauan Mac 2026"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Laporan:</label>
              <select 
                value={form.kategori}
                onChange={e => setForm({...form, kategori: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none"
              >
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Penerbit:</label>
              <input 
                type="text" 
                value={getUnitDisplayName(getStandardUnitFromSlugOrTitle(unitTitle))}
                disabled
                className="w-full px-3 py-2 border border-slate-100 bg-slate-100 text-slate-400 rounded-xl font-bold font-mono text-[10px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Bulan Log:</label>
              <select 
                value={form.bulan}
                onChange={e => setForm({...form, bulan: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:bg-white"
              >
                {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun Log:</label>
              <input 
                type="number" 
                required
                value={form.tahun}
                onChange={e => setForm({...form, tahun: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan Ringkas Dokumen:</label>
             <textarea 
               rows={2.5}
               value={form.keterangan}
               onChange={e => setForm({...form, keterangan: e.target.value})}
               placeholder="Tambah coretan ringkas jika ada..."
               className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none"
             />
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 gap-1 mt-2 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-4.5 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-xl border border-slate-200/60 cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/10 border border-indigo-500"
            >
              {loading ? 'Disegerakkan ke Drive...' : 'Simpan & Segerakkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
