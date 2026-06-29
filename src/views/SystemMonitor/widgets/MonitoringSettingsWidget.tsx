import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { MonitoringSettings } from '../../../types/monitoring';

interface MonitoringSettingsWidgetProps {
  settings: MonitoringSettings | null;
  loading: boolean;
  error: string | null;
  onSave: (newSettings: MonitoringSettings) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export function MonitoringSettingsWidget({
  settings,
  loading,
  error,
  onSave,
  onClose
}: MonitoringSettingsWidgetProps) {
  const [formData, setFormData] = useState<MonitoringSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">Memuatkan tetapan observabiliti...</div>
    );
  }

  if (error || !formData) {
    return (
      <div className="p-6 text-center text-xs text-rose-500">
        Ralat: {error || 'Tetapan tidak dapat diformat.'}
      </div>
    );
  }

  const handleInputChange = (field: keyof MonitoringSettings, value: any) => {
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleThresholdChange = (field: keyof MonitoringSettings['thresholds'], value: number) => {
    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        thresholds: {
          ...prev.thresholds,
          [field]: value
        }
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setIsSaving(true);
    setSaveStatus(null);
    const res = await onSave(formData);
    if (res.success) {
      setSaveStatus({ type: 'success', message: 'Tetapan observabiliti berjaya disimpan!' });
      setTimeout(() => {
        setSaveStatus(null);
        onClose();
      }, 2000);
    } else {
      setSaveStatus({ type: 'error', message: res.error || 'Gagal menyimpan tetapan.' });
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner w-full">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-slate-600" />
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Konfigurasi Observabiliti PPD</h3>
            <p className="text-[10px] text-slate-400">Konfigurasikan had amaran, sela masa segar semula dan storan cache.</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
        >
          Tutup Tetapan
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Section 1: Intervals and Cache */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Tetapan Sistem &amp; Cache</h4>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Sela Masa Segar Semula Manual (ms)</label>
              <select
                value={formData.refreshInterval}
                onChange={(e) => handleInputChange('refreshInterval', parseInt(e.target.value))}
                className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value={10000}>10 saat</option>
                <option value={30000}>30 saat (Lalai)</option>
                <option value={60000}>60 saat</option>
                <option value={120000}>2 minit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">In-Memory Cache TTL (saat)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={formData.cacheTTL}
                onChange={(e) => handleInputChange('cacheTTL', parseInt(e.target.value))}
                className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">Mengurangkan bacaan Firestore bagi kaedah getDocs manual (Lalai: 30s).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Kesihatan Google Drive Audit Threshold (Minit)</label>
              <input
                type="number"
                min={5}
                max={1440}
                value={formData.healthThresholdMinutes}
                onChange={(e) => handleInputChange('healthThresholdMinutes', parseInt(e.target.value))}
                className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">Google Drive ditandakan WARNING sekiranya tiada fail berjaya dimuat naik dalam tempoh ini (Lalai: 60 minit).</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="liveModeDefault"
                checked={formData.liveModeDefault}
                onChange={(e) => handleInputChange('liveModeDefault', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500/20"
              />
              <label htmlFor="liveModeDefault" className="text-xs font-bold text-slate-700 cursor-pointer">Aktifkan Modul Live (onSnapshot) Secara Lalai</label>
            </div>
          </div>

          {/* Section 2: Alert Thresholds */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Enjin Ambang Amaran (Alert Thresholds)</h4>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Amaran Kadar Kejayaan Sektor (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                value={formData.thresholds.successRateWarning}
                onChange={(e) => handleThresholdChange('successRateWarning', parseFloat(e.target.value))}
                className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">SLA Amaran dikesan sekiranya kadar kejayaan hari ini berada di bawah peratusan ini (Lalai: 95%).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Had Amaran Kegagalan Muat Naik (Fail Gagal)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.thresholds.failedUploadsWarning}
                onChange={(e) => handleThresholdChange('failedUploadsWarning', parseInt(e.target.value))}
                className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">Mencetuskan amaran warna sekiranya fail gagal melebihi had bilangan ini hari ini (Lalai: 10 fail).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Had Alert Pengehad Kadar / Rate Limit (Sekat/Hari)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={formData.thresholds.rateLimitEventsAlert}
                onChange={(e) => handleThresholdChange('rateLimitEventsAlert', parseInt(e.target.value))}
                className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">Mencetuskan indikator keselamatan sekiranya sekatan sekuriti melebihi bilangan ini (Lalai: 20 sekat).</p>
            </div>
          </div>

        </div>

        {saveStatus && (
          <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
            saveStatus.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            {saveStatus.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span className="font-bold">{saveStatus.message}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm cursor-pointer"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
