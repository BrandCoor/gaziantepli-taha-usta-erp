import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Search,
  Phone,
  Sparkles,
  Wifi,
  Lock,
  Hash,
  Globe
} from 'lucide-react';
import { WaiterConfig, SectionConfig, restaurantDataService, getPublicBaseUrl, setPublicBaseUrl } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';
import { deviceService } from '../../../services/deviceService';
import { realtimeSyncService } from '../../../services/realtimeSyncService';

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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [publicBase, setPublicBase] = useState<string>(() => getPublicBaseUrl());
  const [showDomainConfig, setShowDomainConfig] = useState<boolean>(false);

  // Garson telefonu PIN ile giris yaptiginda kasa listesi anlik tazelensin.
  useEffect(() => {
    const unsub = realtimeSyncService.subscribe((event) => {
      if (event.type === 'WAITER_PAIRED' || event.type === 'WAITER_RESET') {
        onRefresh();
      }
    });
    return () => unsub();
  }, [onRefresh]);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    pin: '1234',
    allowedSections: ['ALL'],
    permissions: {
      canDiscount: false,
      canVoidItem: false,
      canGift: false,
      canTransferTable: true,
      canPrintBill: true,
    },
  });

  // PIN, garsonun tek kimligidir: baska bir garsonda kullanilmayan bir kod uretir.
  const generateRandomPin = () => restaurantDataService.generateUniquePin();

  const openNewWaiterModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      phone: '',
      pin: generateRandomPin(),
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

    // Garson yalnızca PIN ile tanındığı için aynı PIN iki kişide olamaz.
    const pinOwner = restaurantDataService.findWaiterByPin(form.pin.trim());
    if (pinOwner && pinOwner.id !== editingId) {
      return notify.error(
        'Bu PIN Kullanılıyor',
        `${form.pin} PIN kodu [${pinOwner.name}] adlı garsona tanımlı. Her garsonun PIN'i benzersiz olmalıdır.`
      );
    }

    if (editingId) {
      const ok = restaurantDataService.updateWaiter(editingId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        pin: form.pin.trim(),
        allowedSections: form.allowedSections,
        permissions: form.permissions,
      });
      if (!ok) return notify.error('Kaydedilemedi', 'Bu PIN kodu başka bir garsonda kullanılıyor.');
      notify.success('Garson Güncellendi', `[${form.name}] bilgileri kaydedildi.`);
      setModalOpen(false);
      onRefresh();
    } else {
      const newWaiter = restaurantDataService.addWaiter({
        name: form.name.trim(),
        phone: form.phone.trim(),
        pin: form.pin.trim(),
        status: 'NOT_PAIRED',
        allowedSections: form.allowedSections,
        permissions: form.permissions,
      });
      if (!newWaiter) return notify.error('Kaydedilemedi', 'Bu PIN kodu başka bir garsonda kullanılıyor.');
      notify.success(
        'Garson Eklendi',
        `[${form.name}] kaydedildi. Telefondan garson uygulamasını açıp ${form.pin} PIN kodu ile giriş yapabilir.`
      );
      setModalOpen(false);
      onRefresh();
    }
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

  const handleResetDevice = async (w: WaiterConfig) => {
    try {
      await deviceService.resetDevicePairing(w.id);
    } catch (e) {}
    restaurantDataService.resetWaiterDevice(w.id);
    notify.info('Cihaz Sıfırlandı', `[${w.name}] garsonunun kayıtlı telefonu silindi. Garson PIN kodu ile tekrar giriş yaptığında yeni telefonu kaydedilir.`);
    onRefresh();
  };

  const getAppWaiterTerminalUrl = () => {
    const publicBase = getPublicBaseUrl();
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const origin = isLocal ? publicBase : (typeof window !== 'undefined' ? window.location.origin : publicBase);
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const cleanPath = isLocal ? '' : (pathname.endsWith('/') ? pathname : pathname + '/');
    const baseWithSlash = isLocal ? (origin.endsWith('/') ? origin : origin + '/') : (cleanPath === '/' ? (origin.endsWith('/') ? origin : origin + '/') : origin + cleanPath);
    return `${baseWithSlash}#/garson`;
  };

  const handleSaveDomain = () => {
    const value = publicBase.trim().replace(/\/+$/, '');
    if (value && !/^https?:\/\//i.test(value)) {
      return notify.error('Geçersiz Adres', 'Adres http:// veya https:// ile başlamalıdır.');
    }
    setPublicBaseUrl(value);
    setPublicBase(value);
    notify.success(
      'Garson Uygulama Adresi Kaydedildi',
      value ? `Garson terminali adresi: ${value}` : 'Adres temizlendi. Terminal bağlantısı bu cihazın adresini kullanacak.'
    );
    setShowDomainConfig(false);
  };

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    notify.info('Kod Kopyalandı', `Eşleştirme kodu [${code}] panoya kopyalandı.`);
  };

  const filteredWaiters = waiters.filter(w => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (w.name || '').toLowerCase().includes(term) ||
      (w.phone || '').toLowerCase().includes(term) ||
      (w.deviceName || '').toLowerCase().includes(term) ||
      (w.deviceUuid || '').toLowerCase().includes(term) ||
      (w.pin || '').includes(term)
    );
  });

  const activePairedCount = waiters.filter(w => w.status === 'APPROVED' && (w.deviceUuid || w.macAddress)).length;

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
                <span>Garson Mobil Telefon & Cihaz Eşleştirme Yönetimi</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PIN ile Giriş
                </span>
              </h2>
              <p className="text-xs text-[#A0A0AA]">
                Garson, telefonundan garson uygulamasını açıp <b>kendi 4 haneli PIN kodunu</b> girerek giriş yapar. PIN kodları benzersizdir; garson yalnızca PIN'i ile tanınır. İlk girişte kullandığı telefon kayda alınır ve bu ekranda <b>Bağlı & Mühürlü</b> olarak görünür.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-[#141416] px-3.5 py-2 rounded-2xl border border-[#2C2C34] flex items-center gap-2.5 text-xs">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-[#A0A0AA]">Bağlı Telefon:</span>
            <span className="font-mono font-black text-white">{activePairedCount} / {waiters.length}</span>
          </div>

          <button
            onClick={openNewWaiterModal}
            className="px-4 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 text-slate-950 text-xs font-black rounded-2xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Garson Tanımla</span>
          </button>

          <button
            onClick={() => setShowDomainConfig(v => !v)}
            className="px-3.5 py-2.5 bg-[#141416] hover:bg-[#232329] border border-[#2C2C34] text-[#C4C4CC] text-xs font-bold rounded-2xl flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Garson uygulamasının internet adresini ayarla"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Uygulama Adresi</span>
          </button>
        </div>
      </div>

      {/* GARSON UYGULAMA ADRESİ AYARI */}
      {showDomainConfig && (
        <div className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] space-y-3">
          <div className="space-y-1">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Garson Uygulaması İnternet Adresi</span>
            </h3>
            <p className="text-[11px] text-[#8E8E98]">
              Garsonların telefonundan açacağı adres. Hosting'inize yüklediğiniz garson klasörünün adresini yazın
              (örnek: <span className="font-mono text-[#C4C4CC]">https://garson.isletmeadi.com</span>). Boş bırakılırsa
              "Terminali Aç" bağlantısı bu bilgisayarın adresini kullanır.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={publicBase}
              onChange={(e) => setPublicBase(e.target.value)}
              placeholder="https://garson.isletmeadi.com"
              className="flex-1 px-3.5 py-2.5 bg-[#141416] border border-[#383844] rounded-2xl text-xs font-mono text-white placeholder-[#6E6E78] focus:outline-none focus:border-sky-400"
            />
            <button
              onClick={handleSaveDomain}
              className="px-5 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-black rounded-2xl cursor-pointer transition-colors"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      {/* 2. ARAMA & FİLTRELEME ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8E8E98]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Garson adı, telefon, kod veya cihaz ara..."
            className="w-full pl-10 pr-4 py-2 bg-[#1C1C20] border border-[#2C2C34] rounded-2xl text-xs text-white placeholder-[#8E8E98] focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        <div className="text-xs text-[#8E8E98]">
          Toplam <strong className="text-white">{filteredWaiters.length}</strong> kayıtlı personel listeleniyor
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
          const isPaired = w.status === 'APPROVED' && Boolean(w.deviceUuid || w.macAddress);

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
                      title="Düzenle"
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

                {/* Bağlı Cihaz & Eşleşme Bilgileri */}
                <div className="mt-4 p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2.5 text-xs">
                  {/* Durum Rozeti */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#8E8E98]">Cihaz Durumu:</span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      isPaired 
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isPaired ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                      {isPaired ? 'Bağlı & Mühürlü' : 'Eşleşme Bekliyor'}
                    </span>
                  </div>

                  {/* Cihaz Modeli */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#8E8E98] flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                      Cihaz Modeli:
                    </span>
                    <strong className="text-white font-medium truncate max-w-[150px]">
                      {w.deviceName || (isPaired ? 'Mobil Telefon' : 'Henüz Bağlanmadı')}
                    </strong>
                  </div>

                  {/* Giriş artık yalnızca PIN ile yapılır; QR ve eşleşme kodu kaldırıldı. */}
                  <div className="flex items-center justify-between bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <span className="text-amber-300 text-[11px] font-bold flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" />
                      Giriş PIN Kodu:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-black text-amber-300 tracking-widest">
                        {w.pin || '----'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(w.pin || '')}
                        className="p-1 text-amber-400 hover:text-white rounded transition-colors cursor-pointer"
                        title="PIN Kodunu Kopyala"
                      >
                        {copiedCode === w.pin && w.pin
                          ? <Check className="w-3 h-3 text-emerald-400" />
                          : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {isPaired && (
                    <div className="flex items-center justify-between text-[#8E8E98]">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Son Giriş Cihazı:
                      </span>
                      <span className="font-mono text-[11px] text-emerald-300 truncate max-w-[140px]">
                        {(w.deviceUuid || w.macAddress || '').slice(0, 12)}...
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[#8E8E98] pt-1 border-t border-[#2C2C34]/60">
                    <span>Yetkili Salonlar:</span>
                    <strong className="text-amber-300 text-[11px]">
                      {w.allowedSections?.includes('ALL') ? 'Tüm Salonlar' : `${w.allowedSections?.length || 1} Bölüm`}
                    </strong>
                  </div>

                  {/* İzin Rozetleri */}
                  <div className="pt-1.5 flex flex-wrap gap-1">
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
                      Fiş Yazdır
                    </span>
                  </div>
                </div>
              </div>

              {/* Giriş aksiyonları — QR kaldırıldı, giriş yalnızca PIN ile yapılır */}
              <div className="space-y-2 pt-2">
                {Boolean(getAppWaiterTerminalUrl()) && (
                  <a
                    href={getAppWaiterTerminalUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    title="Garson terminalini yeni sekmede aç"
                  >
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    <span>Terminali Aç</span>
                  </a>
                )}


                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] text-[#8E8E98] flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Giriş: PIN {w.pin || '----'}</span>
                  </span>

                  {isPaired ? (
                    <button
                      onClick={() => handleResetDevice(w)}
                      className="text-[11px] text-[#8E8E98] hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Kayıtlı telefonu sil (garson yeni telefonundan PIN ile girebilsin)"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Telefonu Sıfırla</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-400/80 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Henüz Giriş Yapmadı
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}


      {/* ========================================================================= */}
      {/* 5. YENİ GARSON TANIMLA / DÜZENLE MODALI */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#F5C877]" />
                <span>{editingId ? 'Garson Bilgilerini Düzenle' : 'Yeni Garson Tanımla'}</span>
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

              {/* Bilgilendirme Notu */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
                <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                <span>Garson, telefonundan garson uygulamasını açıp aşağıdaki <b>PIN kodunu</b> girerek giriş yapar. Her garsonun PIN kodu benzersiz olmalıdır; PIN'i başka birine vermeyin.</span>
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
                  {editingId ? 'Güncelle' : 'Garsonu Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
