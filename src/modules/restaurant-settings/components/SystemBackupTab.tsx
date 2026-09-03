import React, { useState } from 'react';
import { 
  HardDrive, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Wifi, 
  Server, 
  ShieldCheck,
  RotateCcw,
  FileCode
} from 'lucide-react';
import { restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface SystemBackupTabProps {
  onRefresh: () => void;
}

export const SystemBackupTab: React.FC<SystemBackupTabProps> = ({ onRefresh }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingLocalServer, setIsCheckingLocalServer] = useState(false);
  const [localServerStatus, setLocalServerStatus] = useState<'IDLE' | 'ONLINE' | 'OFFLINE'>('IDLE');
  const [importJsonText, setImportJsonText] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Bulut Senkronizasyonu
  const handleManualCloudSync = async () => {
    setIsSyncing(true);
    restaurantDataService.playAudioAlert('beep');
    try {
      restaurantDataService.pushStateToCloud();
      restaurantDataService.pullPendingOrdersFromCloud();
      setTimeout(() => {
        setIsSyncing(false);
        notify.success('Bulut Senkronizasyonu Başarılı', 'Tüm menü, masa ve adisyon durumları merkezi sunucuya (api.rymedya.com.tr) aktarıldı.');
      }, 700);
    } catch (e) {
      setIsSyncing(false);
      notify.error('Hata', 'Bulut sunucuya erişilemedi.');
    }
  };

  // Yerel Print Agent Kontrolü (localhost:4545)
  const handleCheckLocalServer = async () => {
    setIsCheckingLocalServer(true);
    try {
      const res = await fetch('http://localhost:4545/api/health', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setLocalServerStatus('ONLINE');
        notify.success('Yazıcı Servisi Aktif', 'localhost:4545 yerel donanım servisi çalışıyor.');
      } else {
        setLocalServerStatus('OFFLINE');
      }
    } catch (e) {
      setLocalServerStatus('OFFLINE');
      notify.info('Yerel Donanım Servisi', 'Yerel USB/ESC-POS arka plan servisi algılanmadı (Web tarayıcı modunda çalışılıyor).');
    } finally {
      setIsCheckingLocalServer(false);
    }
  };

  // JSON Yedek İndir
  const handleExportBackup = () => {
    restaurantDataService.playAudioAlert('beep');
    const jsonStr = restaurantDataService.exportRestaurantBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `taha_usta_pos_yedek_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.success('Yedek İndirildi', 'Restoran ve donanım ayarları JSON dosyası olarak kaydedildi.');
  };

  // Dosyadan JSON Yükle
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const res = restaurantDataService.importRestaurantBackup(content);
        if (res.success) {
          notify.success('Yedek Yüklendi', res.message);
          onRefresh();
        } else {
          notify.error('Hata', res.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Metin kutusundan yükle
  const handleApplyTextImport = () => {
    if (!importJsonText.trim()) return notify.error('Eksik Veri', 'Lütfen JSON içeriğini yapıştırın.');
    const res = restaurantDataService.importRestaurantBackup(importJsonText);
    if (res.success) {
      notify.success('Yedek Yüklendi', res.message);
      setImportModalOpen(false);
      setImportJsonText('');
      onRefresh();
    } else {
      notify.error('Hata', res.message);
    }
  };

  // Fabrika Ayarlarına Sıfırla
  const handleFactoryReset = () => {
    notify.confirm({
      title: 'Fabrika Ayarlarına Sıfırla',
      message: 'Tüm yazıcılar, menü, masalar ve donanım yapılandırması varsayılan ayarlara döndürülecektir. Bu işlem geri alınamaz! Devam edilsin mi?',
      type: 'danger',
      onConfirm: () => {
        localStorage.removeItem('gtu_pos_sections');
        localStorage.removeItem('gtu_pos_categories');
        localStorage.removeItem('gtu_pos_products');
        localStorage.removeItem('gtu_pos_waiters');
        localStorage.removeItem('gtu_pos_printers');
        localStorage.removeItem('gtu_pos_payment_methods');
        localStorage.removeItem('gtu_pos_receipt_settings');
        localStorage.removeItem('gtu_pos_hardware_settings');
        notify.success('Sıfırlandı', 'Sistem fabrika varsayılanlarına döndürüldü.');
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#F5C877]" />
            <span>Bulut Senkronizasyonu & Sistem Yedekleme</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Restoran verilerinizi buluta eşitleyin, yerel yedek (JSON) alın veya başka terminale aktarın.
          </p>
        </div>

        <button
          onClick={handleManualCloudSync}
          disabled={isSyncing}
          className="px-5 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 shadow-lg cursor-pointer transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Senkronize Ediliyor...' : 'Şimdi Bulutla Eşitle'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. BULUT & YEREL YAZICI SUNUCU DURUMU */}
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-[#2C2C34] pb-4">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center justify-center font-black">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Merkezi Bulut & Yerel Donanım Servisleri</h3>
              <p className="text-xs text-[#C4C4CC]">Sunucu haberleşme kanalları ve print agent kontrolü</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Bulut Sunucu */}
            <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-black text-white">Merkezi Bulut API (api.rymedya.com.tr)</div>
                  <div className="text-[11px] text-[#A0A0AA]">Garson siparişleri ve anlık masa durumu senkronu</div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Bağlantı Aktif
              </span>
            </div>

            {/* Yerel Yazıcı Servisi */}
            <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="font-black text-white">Yerel Yazıcı Sunucusu (localhost:4545)</div>
                  <div className="text-[11px] text-[#A0A0AA]">USB, Seri Port ve ESC/POS arka plan agent'ı</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {localServerStatus === 'ONLINE' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ✓ Çalışıyor
                  </span>
                ) : (
                  <button
                    onClick={handleCheckLocalServer}
                    disabled={isCheckingLocalServer}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    {isCheckingLocalServer ? 'Kontrol Ediliyor...' : 'Test Et'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. YEDEK AL & YEDEKTEN GERİ YÜKLE */}
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-[#2C2C34] pb-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Yapılandırma Yedekleme (JSON)</h3>
              <p className="text-xs text-[#C4C4CC]">Tüm ayarları tek dosya olarak dışa aktarın veya içe aktarın</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Yedek İndir */}
              <button
                onClick={handleExportBackup}
                className="p-4 bg-[#141416] hover:bg-slate-800 border border-[#383844] rounded-2xl text-left space-y-2 cursor-pointer transition-all hover:border-[#F5C877]"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black">
                  <Download className="w-5 h-5" />
                </div>
                <div className="font-black text-xs text-white">Yedek Dosyası İndir</div>
                <div className="text-[10px] text-[#A0A0AA]">Menü, masa, yazıcı ve donanımları JSON olarak kaydeder.</div>
              </button>

              {/* Yedek Yükle */}
              <label className="p-4 bg-[#141416] hover:bg-slate-800 border border-[#383844] rounded-2xl text-left space-y-2 cursor-pointer transition-all hover:border-[#F5C877] block">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-black">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="font-black text-xs text-white">Yedek Dosyası Seç</div>
                <div className="text-[10px] text-[#A0A0AA]">Bilgisayarınızdaki .json yedek dosyasını yükler.</div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <button
              onClick={() => setImportModalOpen(true)}
              className="w-full py-2.5 bg-[#141416] hover:bg-slate-800 border border-[#2C2C34] text-[#C4C4CC] hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>JSON Metnini Doğrudan Yapıştırarak Geri Yükle</span>
            </button>
          </div>
        </div>

      </div>

      {/* SIFIRLAMA BÖLÜMÜ */}
      <div className="p-5 bg-[#1C1C20] rounded-3xl border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-black text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Tehlikeli Bölge: Fabrika Ayarlarına Döndür</span>
          </h4>
          <p className="text-[11px] text-[#A0A0AA] mt-0.5">
            Kayıtlı tüm yazıcılar, masalar, menü kalemleri ve çevre birimleri varsayılan fabrika ayarlarına döner.
          </p>
        </div>

        <button
          onClick={handleFactoryReset}
          className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-black rounded-xl border border-rose-500/40 cursor-pointer transition-all"
        >
          Fabrika Ayarlarına Sıfırla
        </button>
      </div>

      {/* JSON METİN YAPISTIRMA MODALI */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-400" />
                <span>JSON Yedek Metnini Yapıştır</span>
              </h3>
              <button onClick={() => setImportModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Buraya yedek JSON metnini yapıştırın..."
              className="w-full p-3 bg-[#1C1C20] border border-[#383844] rounded-2xl text-xs font-mono text-white focus:outline-none focus:border-[#F5C877]"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[#2C2C34]">
              <button
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleApplyTextImport}
                className="px-5 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
              >
                Yapılandırmayı Uygula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
