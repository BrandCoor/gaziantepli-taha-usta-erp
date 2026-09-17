import React, { useState } from 'react';
import { 
  Smartphone, 
  Plus, 
  Trash2, 
  Edit3, 
  QrCode, 
  Copy, 
  Check, 
  RotateCcw, 
  ShieldCheck, 
  ExternalLink,
  Search,
  Phone,
  Radio,
  Printer,
  Sparkles,
  Wifi,
  Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WaiterConfig, SectionConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

export interface WaitersTabProps {
  waiters: WaiterConfig[];
  sections?: SectionConfig[];
  onRefresh: () => void;
  embedded?: boolean;
}

export const WaitersTab: React.FC<WaitersTabProps> = ({ 
  waiters, 
  sections = [], 
  onRefresh,
  embedded = false
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrModalWaiter, setQrModalWaiter] = useState<WaiterConfig | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    pin: '1234',
    deviceName: 'Apple iPhone',
    macAddress: '',
    allowedSections: ['ALL'],
    permissions: {
      canDiscount: false,
      canVoidItem: false,
      canGift: false,
      canTransferTable: true,
      canPrintBill: true,
    },
  });

  const generateRandomMac = () => {
    return restaurantDataService.generateMacAddress();
  };

  const generateRandomPin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const openNewWaiterModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      phone: '',
      pin: generateRandomPin(),
      deviceName: 'iPhone / Android',
      macAddress: generateRandomMac(),
      allowedSections: ['ALL'],
      permissions: {
        canDiscount: false,
        canVoidItem: false,
        canGift: false,
        canTransferTable: true,
        canPrintBill: true,
      },
    });
    setModalOpen(true);
  };

  const openEditWaiterModal = (w: WaiterConfig) => {
    setEditingId(w.id);
    setForm({
      name: w.name,
      phone: w.phone || '',
      pin: w.pin,
      deviceName: w.deviceName || 'Mobil Terminal',
      macAddress: w.macAddress || generateRandomMac(),
      allowedSections: w.allowedSections || ['ALL'],
      permissions: {
        canDiscount: w.permissions?.canDiscount ?? false,
        canVoidItem: w.permissions?.canVoidItem ?? false,
        canGift: w.permissions?.canGift ?? false,
        canTransferTable: w.permissions?.canTransferTable ?? true,
        canPrintBill: w.permissions?.canPrintBill ?? true,
      },
    });
    setModalOpen(true);
  };

  const handleSaveWaiter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Bilgi', 'Garson adını giriniz.');
    if (!form.pin || form.pin.length !== 4) return notify.error('Geçersiz PIN', 'Giriş şifresi 4 haneli rakam olmalıdır.');

    const cleanMac = form.macAddress.trim().toUpperCase() || generateRandomMac();

    if (editingId) {
      restaurantDataService.updateWaiter(editingId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        pin: form.pin.trim(),
        deviceName: form.deviceName.trim() || 'Telefon (Eşleşti)',
        macAddress: cleanMac,
        status: 'APPROVED',
        allowedSections: form.allowedSections,
        permissions: form.permissions,
      });
      notify.success('Garson Güncellendi', `[${form.name}] garsonunun telefon ve MAC tanımlamaları kaydedildi.`);
    } else {
      restaurantDataService.addWaiter({
        name: form.name.trim(),
        phone: form.phone.trim(),
        pin: form.pin.trim(),
        deviceName: form.deviceName.trim() || 'Telefon (Eşleşti)',
        macAddress: cleanMac,
        status: 'APPROVED',
        allowedSections: form.allowedSections,
        permissions: form.permissions,
      });
      notify.success('Garson Eklendi', `[${form.name}] için MAC adresi tanımlandı ve QR portal anahtarı üretildi.`);
    }
    setModalOpen(false);
    onRefresh();
  };

  const handleDeleteWaiter = (id: string, name: string) => {
    notify.confirm({
      title: 'Garsonu Kaldır',
      message: `[${name}] garsonunu ve sisteme bağlı telefon eşleşmesini silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteWaiter(id);
        notify.success('Garson Silindi', `[${name}] ve cihaz kaydı kaldırıldı.`);
        onRefresh();
      }
    });
  };

  const handleResetDevice = (w: WaiterConfig) => {
    restaurantDataService.resetWaiterDevice(w.id);
    notify.info('Cihaz Sıfırlandı', `[${w.name}] garsonunun cihaz bağlantısı sıfırlandı. Yeni QR okutularak MAC adresi tekrar bağlanabilir.`);
    onRefresh();
  };

  const getWaiterConnectUrl = (w: WaiterConfig) => {
    const macParam = w.macAddress ? `&mac=${encodeURIComponent(w.macAddress)}` : '';
    return `https://garson.rymedya.com.tr/?token=${w.qrToken}${macParam}`;
  };

  const handleCopyLink = (w: WaiterConfig) => {
    const url = getWaiterConnectUrl(w);
    navigator.clipboard.writeText(url);
    setCopiedToken(w.qrToken);
    setTimeout(() => setCopiedToken(null), 2000);
    notify.info('Giriş Linki Kopyalandı', `${w.name} için garson.rymedya.com.tr giriş linki panoya kopyalandı.`);
  };

  const filteredWaiters = waiters.filter(w => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (w.name || '').toLowerCase().includes(term) ||
      (w.phone || '').toLowerCase().includes(term) ||
      (w.deviceName || '').toLowerCase().includes(term) ||
      (w.macAddress || '').toLowerCase().includes(term) ||
      (w.pin || '').includes(term)
    );
  });

  const activePairedCount = waiters.filter(w => w.status === 'APPROVED' && w.macAddress).length;

  return (
    <div className="space-y-5">
      {/* 1. ÜST BİLGİLENDİRME & BAŞLIK BANNERI */}
      <div className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-[#F5C877] border border-[#F5C877]/30 flex items-center justify-center font-black shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>Garson Mobil El Terminali & MAC Adresi Yönetimi</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  garson.rymedya.com.tr
                </span>
              </h2>
              <p className="text-xs text-[#A0A0AA]">
                Her garsonun telefonu sisteme QR ile MAC adresi tanımlanarak bağlanır ve PIN şifresiyle{' '}
                <strong className="text-amber-300 font-mono">garson.rymedya.com.tr</strong> adresinden giriş yapar.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-[#141416] px-3.5 py-2 rounded-2xl border border-[#2C2C34] flex items-center gap-2.5 text-xs">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-[#A0A0AA]">Tanımlı Telefon:</span>
            <span className="font-mono font-black text-white">{activePairedCount} / {waiters.length}</span>
          </div>

          <button
            onClick={openNewWaiterModal}
            className="px-4 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 text-slate-950 text-xs font-black rounded-2xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Garson & Telefon Tanımla</span>
          </button>
        </div>
      </div>

      {/* 2. ARAMA & FİLTRELEME ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8E8E98]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Garson adı, telefon, cihaz veya MAC adresi ara..."
            className="w-full pl-10 pr-4 py-2 bg-[#1C1C20] border border-[#2C2C34] rounded-2xl text-xs text-white placeholder-[#8E8E98] focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        <div className="text-xs text-[#8E8E98]">
          Toplam <strong className="text-white">{filteredWaiters.length}</strong> kayıtlı garson terminali listeleniyor
        </div>
      </div>

      {/* 3. GARSON KARTLARI LİSTESİ */}
      {filteredWaiters.length === 0 ? (
        <div className="bg-[#1C1C20] rounded-3xl p-12 border border-[#2C2C34] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#F5C877] flex items-center justify-center mx-auto">
            <Smartphone className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-black text-white">Kayıtlı Garson / Mobil Terminal Yok</h3>
            <p className="text-xs text-[#8E8E98]">
              Sistemde henüz tanımlı garson bulunmuyor. Yeni bir garson veya telefon eşleştirmesi oluşturmak için yukarıdaki butonu kullanabilirsiniz.
            </p>
          </div>
          <button
            onClick={openNewWaiterModal}
            className="px-5 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ İlk Garsonu Tanımla</span>
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredWaiters.map((w) => {
          const isPaired = w.status === 'APPROVED' && Boolean(w.macAddress);
          const connectUrl = getWaiterConnectUrl(w);

          return (
            <div 
              key={w.id} 
              className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-xl flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all group"
            >
              <div>
                {/* Kart Üst Bilgisi: İsim, Telefon & PIN */}
                <div className="flex items-start justify-between pb-3 border-b border-[#2C2C34]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-[#F5C877] border border-[#F5C877]/30 flex items-center justify-center font-black shadow-inner">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                        <span>{w.name}</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {w.phone ? (
                          <span className="text-[11px] text-[#A0A0AA] flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-amber-400" />
                            {w.phone}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Telefon No Yok</span>
                        )}
                        <span className="text-[10px] font-mono text-amber-300 font-black bg-[#141416] px-2 py-0.5 rounded-lg border border-[#2C2C34] flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          PIN: {w.pin}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditWaiterModal(w)}
                      className="p-1.5 text-[#C4C4CC] hover:text-amber-400 hover:bg-[#282830] rounded-xl cursor-pointer transition-colors"
                      title="Düzenle / MAC Değiştir"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWaiter(w.id, w.name)}
                      className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-xl cursor-pointer transition-colors"
                      title="Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bağlı Cihaz & MAC Adresi Detayları */}
                <div className="mt-4 p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8E8E98] flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                      Cihaz Modeli:
                    </span>
                    <strong className="text-white font-medium truncate max-w-[150px]">
                      {w.deviceName || 'Tanımsız Cihaz'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#8E8E98] flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                      MAC Adresi:
                    </span>
                    <strong className="font-mono text-xs text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-800/60">
                      {w.macAddress || 'Tanımlanmadı'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#8E8E98]">Bağlantı Durumu:</span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      isPaired 
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isPaired ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                      {isPaired ? 'Bağlı & MAC Tanımlı' : 'Eşleşme Bekliyor'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#8E8E98] pt-1">
                    <span>Yetkili Salonlar:</span>
                    <strong className="text-amber-300 text-[11px]">
                      {w.allowedSections?.includes('ALL') ? 'Tüm Salonlar' : `${w.allowedSections?.length || 1} Bölüm`}
                    </strong>
                  </div>

                  {/* İzin Rozetleri */}
                  <div className="pt-2 border-t border-[#2C2C34]/80 flex flex-wrap gap-1">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${w.permissions?.canDiscount ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-[#1C1C20] text-slate-600'}`}>
                      İskonto
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${w.permissions?.canVoidItem ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-[#1C1C20] text-slate-600'}`}>
                      İptal
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${w.permissions?.canGift ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-[#1C1C20] text-slate-600'}`}>
                      İkram
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${w.permissions?.canTransferTable ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-[#1C1C20] text-slate-600'}`}>
                      Masa Taşı
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${w.permissions?.canPrintBill ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-[#1C1C20] text-slate-600'}`}>
                      Adisyon Fişi
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Kod & Giriş Aksiyonları */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setQrModalWaiter(w)}
                    className="py-2.5 bg-[#141416] hover:bg-[#282830] border border-[#383844] text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <QrCode className="w-4 h-4 text-[#F5C877]" />
                    <span>QR Kodu Aç</span>
                  </button>

                  <button
                    onClick={() => handleCopyLink(w)}
                    className="py-2.5 bg-[#141416] hover:bg-[#282830] border border-[#383844] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    {copiedToken === w.qrToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
                    <span>{copiedToken === w.qrToken ? 'Kopyalandı' : 'Linki Kopyala'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between px-1">
                  <a
                    href={connectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#A0A0AA] hover:text-amber-400 flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>garson.rymedya.com.tr</span>
                  </a>

                  {isPaired && (
                    <button
                      onClick={() => handleResetDevice(w)}
                      className="text-[11px] text-[#8E8E98] hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Cihaz eşleşmesini kaldırıp yeni QR okutmasını sağla"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Eşleşmeyi Sıfırla</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BÜYÜK QR KOD MODALI (garson.rymedya.com.tr) */}
      {/* ========================================================================= */}
      {qrModalWaiter && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] text-center space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div className="text-left">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>{qrModalWaiter.name}</span>
                </h3>
                <p className="text-[11px] text-[#8E8E98]">Garson Mobil Terminal Eşleştirme QR Kodu</p>
              </div>
              <button 
                onClick={() => setQrModalWaiter(null)} 
                className="text-[#A0A0AA] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Beyaz Çerçeve İçi QR Kod */}
            <div className="p-5 bg-white rounded-3xl inline-block shadow-2xl mx-auto border-4 border-amber-400/30">
              <QRCodeSVG 
                value={getWaiterConnectUrl(qrModalWaiter)}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Cihaz ve Bağlantı Parametreleri */}
            <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] text-left space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>Mobil Portal:</span>
                <strong className="text-emerald-400 font-mono">garson.rymedya.com.tr</strong>
              </div>

              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>Kayıtlı Telefon:</span>
                <strong className="text-white font-mono">{qrModalWaiter.phone || 'Kayıtlı Değil'}</strong>
              </div>

              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>Tanımlı Cihaz Modeli:</span>
                <strong className="text-white">{qrModalWaiter.deviceName || 'Akıllı Telefon'}</strong>
              </div>

              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>Tanımlı MAC Adresi:</span>
                <strong className="font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  {qrModalWaiter.macAddress}
                </strong>
              </div>

              <div className="flex justify-between items-center text-[#8E8E98] pt-1 border-t border-[#2C2C34]">
                <span>Giriş PIN Şifresi:</span>
                <strong className="text-base font-mono font-black text-amber-300 bg-[#282830] px-3 py-0.5 rounded-lg border border-amber-500/30">
                  {qrModalWaiter.pin}
                </strong>
              </div>
            </div>

            {/* Adım Adım Açıklama */}
            <div className="text-[11px] text-[#A0A0AA] bg-[#202026] p-3 rounded-2xl text-left space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Telefon Bağlantı Adımları:</span>
              </div>
              <div>1. Garson kendi telefon kamerasını bu QR koda doğrultur.</div>
              <div>2. <strong>garson.rymedya.com.tr</strong> açılır ve cihaz MAC adresi onaylanır.</div>
              <div>3. 4 haneli PIN şifresini (<span className="text-amber-300 font-mono font-bold">{qrModalWaiter.pin}</span>) girerek anında masalara sipariş almaya başlar.</div>
            </div>

            {/* Butonlar */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleCopyLink(qrModalWaiter)}
                className="py-2.5 bg-[#282830] hover:bg-[#343440] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4 text-sky-400" />
                <span>Linki Kopyala</span>
              </button>

              <a
                href={getWaiterConnectUrl(qrModalWaiter)}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Portala Git</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GARSON & MAC ADRESİ EKLE / DÜZENLE MODALI */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#F5C877]" />
                <span>{editingId ? 'Garson & MAC Adresi Düzenle' : 'Yeni Garson & Telefon Tanımla'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <form onSubmit={handleSaveWaiter} className="space-y-4">
              {/* Garson Adı */}
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Garson Adı Soyadı *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              {/* Telefon Numarası */}
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Telefon Numarası</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Örn: 0532 111 22 33"
                  className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              {/* Telefon Modeli */}
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Telefon Cihaz Modeli</label>
                <input
                  type="text"
                  value={form.deviceName}
                  onChange={(e) => setForm({ ...form, deviceName: e.target.value })}
                  placeholder="Örn: Apple iPhone 13 Pro / Samsung S22"
                  className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-medium text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              {/* MAC Adresi Tanımlama */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#C4C4CC]">Cihaz Fiziksel MAC Adresi *</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, macAddress: generateRandomMac() })}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Rastgele MAC Üret</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={form.macAddress}
                  onChange={(e) => setForm({ ...form, macAddress: e.target.value.toUpperCase() })}
                  placeholder="Örn: 74:D4:35:8B:1A:4C"
                  className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                />
                <p className="text-[10px] text-[#8E8E98] mt-1">
                  Garsonun telefonu bu MAC adresi doğrulanarak sisteme bağlanır.
                </p>
              </div>

              {/* PIN Kodu */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#C4C4CC]">Giriş PIN Kodu (4 Hane) *</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, pin: generateRandomPin() })}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>PIN Üret</span>
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="1234"
                  className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-sm font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Yetkili Salonlar */}
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Yetkili Servis Salonları</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, allowedSections: ['ALL'] })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      form.allowedSections.includes('ALL')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                        : 'bg-[#141416] text-[#8E8E98] border-[#2C2C34]'
                    }`}
                  >
                    Tüm Salonlar
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, allowedSections: ['sec-salon', 'sec-bahce'] })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      !form.allowedSections.includes('ALL')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                        : 'bg-[#141416] text-[#8E8E98] border-[#2C2C34]'
                    }`}
                  >
                    Özel Salonlar
                  </button>
                </div>
              </div>

              {/* POS Yetkileri */}
              <div className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 text-xs">
                <span className="text-[10px] font-black uppercase text-[#C4C4CC] block mb-1">
                  POS & Adisyon Yetkileri
                </span>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-white">İskonto / İndirim Yapabilir</span>
                  <input
                    type="checkbox"
                    checked={form.permissions.canDiscount}
                    onChange={(e) => setForm({
                      ...form,
                      permissions: { ...form.permissions, canDiscount: e.target.checked }
                    })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-white">Ürün İptal Edebilir</span>
                  <input
                    type="checkbox"
                    checked={form.permissions.canVoidItem}
                    onChange={(e) => setForm({
                      ...form,
                      permissions: { ...form.permissions, canVoidItem: e.target.checked }
                    })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-white">İkram Ürün Ekleyebilir</span>
                  <input
                    type="checkbox"
                    checked={form.permissions.canGift}
                    onChange={(e) => setForm({
                      ...form,
                      permissions: { ...form.permissions, canGift: e.target.checked }
                    })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-white">Masa Taşıma & Birleştirme</span>
                  <input
                    type="checkbox"
                    checked={form.permissions.canTransferTable}
                    onChange={(e) => setForm({
                      ...form,
                      permissions: { ...form.permissions, canTransferTable: e.target.checked }
                    })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-white">Adisyon / Fiş Yazdırabilir</span>
                  <input
                    type="checkbox"
                    checked={form.permissions.canPrintBill}
                    onChange={(e) => setForm({
                      ...form,
                      permissions: { ...form.permissions, canPrintBill: e.target.checked }
                    })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>
              </div>

              {/* Kaydet Butonları */}
              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  {editingId ? 'Güncelle' : 'Kaydet & QR Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

