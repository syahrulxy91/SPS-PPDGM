import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Calendar } from 'lucide-react';
import { readRows, appendRow } from '../lib/sheets';
import { getCurrentAppUser } from '../lib/auth';

export default function PengumumanView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const user = getCurrentAppUser();

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await readRows('Pengumuman') || [];
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

  useEffect(() => { loadData(); }, []);

  const isAdmin = user?.email?.toLowerCase() === 'syahrulxy91@gmail.com';

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
    
    try {
      await appendRow('Pengumuman', [
        Date.now().toString(),
        title,
        content,
        new Date().toISOString(),
        user?.name || 'Sistem Admin'
      ]);
      setShowAdd(false);
      loadData();
    } catch (err) {
      alert('Ralat menambah pengumuman');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Notis & Pengumuman</h1>
          <p className="text-slate-500 mt-1">Makluman terkini dan arahan pengurusan SPS.</p>
        </div>
        
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="flex items-center space-x-2 bg-[#1565C0] hover:bg-[#0F2D52] text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
             <Plus className="w-5 h-5" />
             <span>Tambah Notice</span>
          </button>
        )}
      </div>

      {showAdd && (
         <div className="bg-white border text-left border-slate-100 rounded-2xl p-5 shadow-sm">
           <form onSubmit={handleAddSubmit} className="space-y-4">
               <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Tajuk Pengumuman</label>
                  <input required name="title" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0]" placeholder="Cth: Mesyuarat Penyelarasan SPS" />
               </div>
               <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Kandungan</label>
                  <textarea required name="content" rows={4} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0]" placeholder="Butiran makluman.."></textarea>
               </div>
               <div className="flex space-x-3 pt-2">
                 <button type="submit" className="bg-[#0F2D52] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#1565C0] transition-colors">Siarkan Pengumuman</button>
                 <button type="button" onClick={() => setShowAdd(false)} className="bg-slate-50 text-slate-700 px-5 py-2 rounded-lg font-medium hover:bg-slate-100 border border-slate-200 transition-colors">Batal</button>
               </div>
           </form>
         </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuatkan Notis...</div>
      ) : (
        <div className="space-y-4">
           {data.length > 0 ? data.map((noti, i) => (
             <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex space-x-4 hover:border-[#1565C0]/30 transition-colors">
                <div className="p-3 bg-amber-50 rounded-xl h-12 w-12 flex items-center justify-center flex-shrink-0">
                  <Megaphone className="text-amber-600 w-6 h-6" />
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <h3 className="font-bold text-slate-800 text-lg">{noti.title}</h3>
                     <span className="text-xs font-semibold text-slate-500 flex items-center bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                       <Calendar className="w-3 h-3 mr-1" />
                       {new Date(noti.date).toLocaleDateString('ms-MY')}
                     </span>
                   </div>
                   <p className="text-slate-600 mt-2 whitespace-pre-wrap text-sm leading-relaxed">{noti.content}</p>
                   <div className="mt-4 pt-4 border-t border-slate-50 flex items-center text-xs text-slate-400">
                     Oleh: <span className="ml-1 font-semibold text-[#1565C0]">{noti.author}</span>
                   </div>
                </div>
             </div>
           )) : (
             <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100">
               Tiada pengumuman terkini.
             </div>
           )}
        </div>
      )}

    </div>
  );
}
