import React, { useState, useEffect } from 'react';
import { Search, Filter, FileText, Eye, ChevronRight, HelpCircle, Layers, Calendar, Compass, Clock } from 'lucide-react';
import { readRows } from '../lib/sheets';
import { getUnitDisplayName, getStandardUnitFromSlugOrTitle } from '../types';

export default function CarianPintar() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  const loadData = async () => {
    try {
      const dbLaporan = await readRows('Laporan') || [];
      const dbRujukan = await readRows('Rujukan') || [];

      const mapRows = (rows: any[], type: string) => {
         const header = rows[0] || [];
         return rows.slice(1).map(row => {
            const obj: any = {};
            header.forEach((h: string, i: number) => { obj[h] = row[i]; });
            obj.docType = type;
            return obj;
         });
      };

      const all = [...mapRows(dbLaporan, 'Laporan'), ...mapRows(dbRujukan, 'Rujukan')];
      setData(all.reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = data.filter(d => {
    const qMatch = (d.name || '').toLowerCase().includes(query.toLowerCase()) || 
                   (d.keterangan || '').toLowerCase().includes(query.toLowerCase()) ||
                   (d.uploadedBy || '').toLowerCase().includes(query.toLowerCase());
    const cMatch = catFilter ? d.kategori === catFilter : true;
    const uMatch = unitFilter ? getStandardUnitFromSlugOrTitle(d.unit) === getStandardUnitFromSlugOrTitle(unitFilter) : true;
    return qMatch && cMatch && uMatch;
  });

  const uniqueUnits = Array.from(new Set(data.map(d => getStandardUnitFromSlugOrTitle(d.unit)).filter(Boolean)));
  const uniqueCats = Array.from(new Set(data.map(d => d.kategori).filter(Boolean)));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Title Redesign */}
      <div className="pb-6 border-b border-slate-100 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <span>Pencarian Cepat</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="text-indigo-600 font-extrabold">Carian Pintar Global</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">Carian Pintar Global</h1>
        <p className="text-slate-400 text-xs sm:text-sm font-medium">Imbas, tapis, dan dapatkan dokumen dari semua unit Sektor Pengurusan Sekolah Gua Musang.</p>
      </div>

      {/* Advanced Filter Panel Redesign */}
      <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-100 hover:border-indigo-500/10 transition-all">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Cari mengikut nama fail, keterangan ringkas atau nama pemilik..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50/55 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl text-xs sm:text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
             <div className="relative w-full sm:w-52">
               <select 
                 value={unitFilter} 
                 onChange={e => setUnitFilter(e.target.value)}
                 className="w-full appearance-none pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-indigo-500 focus:bg-white transition-all"
               >
                 <option value="">Semua Unit</option>
                 {uniqueUnits.map(u => <option key={u as string} value={u as string}>{getUnitDisplayName(u as string).replace('Unit ', '')}</option>)}
               </select>
               <Filter className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
             </div>
             
             <div className="relative w-full sm:w-52">
               <select 
                 value={catFilter} 
                 onChange={e => setCatFilter(e.target.value)}
                 className="w-full appearance-none pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-indigo-500 focus:bg-white transition-all"
               >
                 <option value="">Semua Kategori</option>
                 {uniqueCats.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
               </select>
               <Filter className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
             </div>
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden hover:border-indigo-500/10 transition-all">
         <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
           <div>
             <h2 className="font-black text-slate-800 text-sm tracking-tight">Keputusan Carian Global</h2>
             <p className="text-[11px] text-slate-400 font-medium">Dua-saluran data (Laporan + Rujukan) bersedia</p>
           </div>
           <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">{filtered.length} keputusan dijumpai</span>
         </div>

         <div className="overflow-x-auto animate-in fade-in duration-300">
          {loading ? (
             <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
               <Clock className="w-8 h-8 text-indigo-500 animate-spin" />
               <span className="text-xs font-bold text-slate-500">Membaca rekod sistem global...</span>
             </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-500 tracking-wider">
                  <th className="p-4 pl-6 font-extrabold">Nama Fail / Keterangan</th>
                  <th className="p-4 font-extrabold">Segmen &amp; Unit</th>
                  <th className="p-4 font-extrabold">Tarikh / Kakitangan</th>
                  <th className="p-4 pr-6 font-extrabold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length > 0 ? filtered.map((doc, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center space-x-3 max-w-sm sm:max-w-md">
                        <div className="p-2 sm:p-2.5 bg-slate-100 rounded-xl border border-slate-200/40 text-indigo-500 shrink-0">
                          <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-700 text-xs sm:text-sm truncate" title={doc.name}>{doc.name}</div>
                          <div className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-1 font-medium">{doc.keterangan || 'Tiada keterangan khas'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                       <div className="flex flex-col space-y-1 items-start">
                         <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                           {doc.kategori || 'SLA_FILE'}
                         </span>
                         <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                           {getUnitDisplayName(getStandardUnitFromSlugOrTitle(doc.unit)).replace('Unit ', '')}
                         </span>
                       </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-semibold text-slate-700">{doc.uploadedBy || 'Pegawai Sistem'}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {(() => {
                          if (!doc.uploadedAt) return 'Tahun ' + (doc.tahun || '0000');
                          const d = new Date(doc.uploadedAt);
                          return isNaN(d.getTime()) ? 'Tahun ' + (doc.tahun || '0000') : d.toLocaleDateString('ms-MY');
                        })()}
                      </div>
                    </td>
                    <td className="p-4 pr-6 flex items-center justify-end">
                       <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center space-x-1.5 text-xs bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 px-3 py-1.5 rounded-xl transition-all font-extrabold cursor-pointer hover:shadow-2xs">
                         <Eye className="w-3.5 h-3.5 shrink-0" />
                         <span>Papar</span>
                       </a>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-300">
                          <Compass className="w-8 h-8" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 mt-2">Carian Tidak Menjumpai Sebarang Rekod</p>
                        <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed mx-auto">Cuba gunakan kata kunci e-mel yang sah, nama unit yang bersekutu, atau ubah penapis kategori global.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
