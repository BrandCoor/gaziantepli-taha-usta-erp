import React, { useState } from 'react';
import { Building2, Upload, Trash2, CheckCircle2, Image as ImageIcon, Sparkles, Code2, ShieldCheck, Clock } from 'lucide-react';
import { dataService, CompanySettings } from '../../services/dataService';

interface CompanySettingsViewProps {
  onSettingsSaved: () => void;
}

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<CompanySettings>(dataService.getCompanySettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      return alert('Logo dosyası boyutu maksimum 3MB olmalıdır.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSettings(prev => ({ ...prev, logoBase64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, logoBase64: '' }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.companyName.trim()) return alert('Firma ünvanı boş bırakılamaz.');
    if (!settings.dailyWorkHours || settings.dailyWorkHours <= 0) return alert('Geçerli bir günlük çalışma saati giriniz.');
    if (!settings.overtimeMultiplier || settings.overtimeMultiplier <= 0) return alert('Geçerli bir mesai çarpanı giriniz.');

    dataService.saveCompanySettings({
      ...settings,
      dailyWorkHours: Number(settings.dailyWorkHours),
      overtimeMultiplier: Number(settings.overtimeMultiplier)
    });
    
    setSaveSuccess(true);
    onSettingsSaved();

    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Firma & Logo Ayarları</h2>
        <p className="text-xs text-slate-500">Programın, raporların ve dökümlerin kurumsal kimlik ayarlarını yönetin</p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>Firma bilgileri, logo ve mesai kuralları başarıyla kaydedildi!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logo Yükleme */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between text-center">
            <div className="w-full">
              <h3 className="font-bold text-slate-900 text-sm mb-1">İşletme Logosu</h3>
              <p className="text-xs text-slate-400 mb-5">Çerçeveye tam oturan dolgulu profil</p>

              <div className="w-36 h-36 mx-auto rounded-full border-4 border-amber-500/50 shadow-2xl overflow-hidden bg-black relative flex items-center justify-center">
                {settings.logoBase64 ? (
                  <img src={settings.logoBase64} alt="Firma Logosu" className="w-full h-full object-fill rounded-full" />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center gap-1.5 p-3">
                    <ImageIcon className="w-8 h-8 text-amber-500/60" />
                    <span className="text-[10px] font-bold text-slate-400 leading-tight">Gaziantepli Taha Usta</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-2 w-full">
                <label className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{settings.logoBase64 ? 'Logoyu Değiştir' : 'Logo Yükle'}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>

                {settings.logoBase64 && (
                  <button type="button" onClick={handleRemoveLogo} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 flex items-center justify-center gap-1.5 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Logoyu Kaldır</span>
                  </button>
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 pt-3">
              Logonuz dairenin tüm sınırlarını tam dolgu (stretch) olarak kaplar
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* Personel & Mesai Ayarları (YENİ) */}
            <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4">
              <h3 className="font-black text-amber-900 text-sm pb-2 border-b border-amber-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Personel & Fazla Mesai Kuralları</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">Personel Günlük Çalışma Saati *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={settings.dailyWorkHours}
                    onChange={e => setSettings({ ...settings, dailyWorkHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-amber-200 focus:border-amber-600 rounded-xl text-xs font-black text-slate-900 bg-white select-text cursor-text focus:outline-none"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">Standart 10 saattir. Fazla mesailer bu saate bölünerek hesaplanır.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">Fazla Mesai Ücret Çarpanı *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={settings.overtimeMultiplier}
                    onChange={e => setSettings({ ...settings, overtimeMultiplier: Number(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-amber-200 focus:border-amber-600 rounded-xl text-xs font-black text-slate-900 bg-white select-text cursor-text focus:outline-none"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">Standart yevmiyenin kaç katı? (1.0 = Birebir, 1.5 = Yüzde 50 zamlı)</p>
                </div>
              </div>
            </div>

            {/* Firma Bilgileri */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Firma İletişim & Fatura Bilgileri</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Firma / Marka Ünvanı *</label>
                  <input type="text" required value={settings.companyName} onChange={e => setSettings({ ...settings, companyName: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold text-slate-900 bg-white focus:outline-none select-text cursor-text" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alt Başlık / Slogan</label>
                  <input type="text" value={settings.subTitle} onChange={e => setSettings({ ...settings, subTitle: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-800 bg-white focus:outline-none select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefon Numarası</label>
                  <input type="text" value={settings.phone} onChange={e => setSettings({ ...settings, phone: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-800 bg-white focus:outline-none select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-Posta Adresi</label>
                  <input type="email" value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-800 bg-white focus:outline-none select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vergi Dairesi</label>
                  <input type="text" value={settings.taxOffice} onChange={e => setSettings({ ...settings, taxOffice: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-800 bg-white focus:outline-none select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vergi / TC No</label>
                  <input type="text" value={settings.taxNumber} onChange={e => setSettings({ ...settings, taxNumber: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-800 bg-white focus:outline-none select-text cursor-text" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Firma Adresi</label>
                  <textarea rows={2} value={settings.address} onChange={e => setSettings({ ...settings, address: e.target.value })} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs text-slate-800 bg-white focus:outline-none select-text cursor-text" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tüm Ayarları Kaydet</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RYMedya Lisans Sertifikası */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" /> Özel Mimaride Kodlanmıştır
              </div>
              <h4 className="font-black text-base text-white tracking-tight">Gaziantepli Taha Usta Özel İşletme Yönetim Sistemi</h4>
              <p className="text-xs text-slate-400 mt-0.5">Bu yazılım sistemi <strong className="text-white">RYMedya</strong> tarafından işletmenizin özel ihtiyaçları doğrultusunda geliştirilmiş ve lisanslanmıştır.</p>
            </div>
          </div>
          <div className="flex flex-col items-end text-right border-t md:border-t-0 md:border-l border-slate-700/80 pt-3 md:pt-0 md:pl-6 w-full md:w-auto">
            <div className="text-[11px] text-slate-400 font-medium">Geliştirici & Altyapı</div>
            <div className="text-lg font-black text-blue-400 tracking-wider">RYMedya</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Sürüm: v1.0.0 (2026)</div>
          </div>
        </div>
      </form>
    </div>
  );
};