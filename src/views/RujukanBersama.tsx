import React, { useState, useEffect } from 'react';
import { Search, Plus, FileText, Download, Eye } from 'lucide-react';
import { readRows, appendRow } from '../lib/sheets';
import { initDriveFolders, uploadFileToDrive } from '../lib/drive';
import { getCurrentAppUser } from '../lib/auth';

const KATEGORI = ['Pekeliling', 'Surat Siaran', 'SOP', 'Garis Panduan', 'Borang Rasmi', 'Template Laporan', 'Dokumen Rujukan'];

export default function RujukanBersama() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  
  const user = getCurrentAppUser();

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await readRows('Rujukan') || [];
      const header = db[0] || [];
      const rows = db.slice(1).map(row => {
        const obj: any = {};
        header.forEach((h: string, i: number) => { obj[h] = row[i]; });
        return obj;
      });
      setData(rows.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadComplete = () => {
    setShowUpload(false);
    loadData();
  };

  const filteredData = data.filter(d => 
    d.name?.toLowerCase().includes(search.toLowerCase()) || 
    d.kategori?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dokumen Rujukan Bersama</h1>
          <p className="text-slate-500 mt-1">Pusat sumber dokumen rasmi, pekeliling, dan garis panduan PPD.</p>
        </div>
        
        <button 
          onClick={() => setShowUpload(true)}
          className="flex items-center space-x-2 bg-[#1565C0] hover:bg-[#0F2D52] text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          <span>Tambah Dokumen</span>
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:border-[#1565C0]/30 transition-colors">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
           <h2 className="font-bold text-slate-800">Senarai Dokumen</h2>
           <div className="relative w-64">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
             <input 
               type="text" 
               placeholder="Cari rujukan..." 
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0]"
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-12 text-center text-slate-400">Memuatkan data...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 tracking-wider">
                  <th className="p-4 font-semibold">Nama Fail / Keterangan</th>
                  <th className="p-4 font-semibold">Kategori</th>
                  <th className="p-4 font-semibold">Tarikh Dimuat Naik</th>
                  <th className="p-4 font-semibold text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? filteredData.map((doc, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-[#1565C0]" />
                        <div>
                          <div className="font-medium text-[#0F2D52]">{doc.name}</div>
                          <div className="text-xs text-gray-500">{doc.keterangan || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        {doc.kategori}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(doc.uploadedAt).toLocaleDateString('ms-MY')}
                    </td>
                    <td className="p-4 flex items-center justify-end space-x-3">
                       <a href={doc.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#1565C0] flex items-center space-x-1 border border-gray-200 px-2 py-1 rounded bg-white" title="Lihat / Muat Turun">
                         <Eye className="w-4 h-4" />
                         <span className="text-xs font-medium">Buka</span>
                       </a>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-400">
                      {search ? "Tiada padanan rujukan ditemui." : "Belum ada dokumen rujukan dimuat naik."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showUpload && <UploadRujukanModal onClose={() => setShowUpload(false)} onComplete={handleUploadComplete} />}
    </div>
  );
}

function UploadRujukanModal({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '',
    kategori: KATEGORI[0],
    keterangan: '',
  });

  const user = getCurrentAppUser();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Sila pilih fail");
    setLoading(true);

    try {
      const { folderMap } = await initDriveFolders();
      // use the mapping to get the right folder ID.
      const folderId = folderMap['RUJUKAN_BERSAMA'];

      if (!folderId) throw new Error("Folder Rujukan tidak dijumpai");

      const uploaded = await uploadFileToDrive(file, folderId);
      
      const newRow = [
        uploaded.id,
        form.name || file.name,
        form.kategori,
        form.keterangan,
        new Date().getFullYear().toString(),
        (new Date().getMonth() + 1).toString().padStart(2, '0'),
        uploaded.url,
        uploaded.size.toString(),
        'Semua Unit',
        new Date().toISOString(),
        user?.name || 'Sistem',
        user?.email || ''
      ];

      await appendRow('Rujukan', newRow);

      // Audit Log
      await appendRow('Audit', [
        Date.now().toString(),
        new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[1].substring(0, 8),
        user?.name,
        user?.email,
        'Upload Dokumen Rujukan: ' + (form.name || file.name),
        'Sistem'
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-[#0F2D52] text-lg">Muat Naik Dokumen Rujukan</h3>
        </div>
        <form onSubmit={handleUpload} className="p-6 overflow-y-auto space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Fail</label>
            <input 
              type="file" 
              required
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-md p-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dokumen</label>
            <input 
              type="text" 
              required
              placeholder="Contoh: Garis Panduan SPS 2026"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#1565C0] focus:border-[#1565C0]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select 
              value={form.kategori}
              onChange={e => setForm({...form, kategori: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#1565C0] focus:border-[#1565C0]"
            >
              {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan Ringkas</label>
             <textarea 
               rows={3}
               value={form.keterangan}
               onChange={e => setForm({...form, keterangan: e.target.value})}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#1565C0] focus:border-[#1565C0]"
             />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-2">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1565C0] hover:bg-[#0F2D52] rounded-md disabled:opacity-50"
            >
              {loading ? 'Memuat Naik...' : 'Upload Dokumen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
