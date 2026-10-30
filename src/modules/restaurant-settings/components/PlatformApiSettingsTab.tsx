import React, { useState, useEffect } from 'react';
import { Bell, Save, RefreshCw, Copy, CheckCheck, Power, ShieldCheck, Search } from 'lucide-react';
import { restaurantDataService, FoodPlatformsConfig } from '../../../services/restaurantDataService';
import { onlinePlatformService, OnlinePlatformCode, StoreAvailabilityStatus, PlatformCredentials } from '../../../services/onlinePlatformService';
import { notify } from '../../../services/notificationService';
import { OnlineDiagnosticsPanel } from '../../online-orders/OnlineDiagnosticsPanel';

export interface PlatformApiSettingsTabProps {
  onSaveSuccess?: () => void;
}

interface FieldDef { key: keyof PlatformCredentials; label: string; placeholder: string; secret?: boolean; help?: string }

/** Her platformun GERÇEKTEN gerektirdiği bilgiler (resmi dokümanlara göre). */
const FIELDS: Record<OnlinePlatformCode, { title: string; where: string; fields: FieldDef[]; advanced?: FieldDef[]; note?: string }> = {
  TRENDYOL: {
    title: 'Trendyol Go Yemek (Uber Eats Trendyol Go)',
    where: 'Trendyol Go Yemek satıcı paneli › Hesap Bilgilerim › Entegrasyon Bilgileri sayfasından alınır.',
    note: 'GetirYemek siparişleri de Trendyol üzerinden bu bağlantıyla gelir (sipariş kartında "Getir" etiketi görünür). Webhook tanımlamanız gerekmez: siparişler Trendyol\'dan 20 saniyede bir otomatik çekilir.',
    fields: [
      { key: 'supplierId', label: 'Satıcı ID (Supplier ID)', placeholder: 'Örn. 123456' },
      { key: 'apiKey', label: 'API Key', placeholder: 'Entegrasyon Bilgileri › API Key' },
      { key: 'secretKey', label: 'Secret Key', placeholder: 'Entegrasyon Bilgileri › Secret Key', secret: true },
      { key: 'email', label: 'Trendyol e-posta', placeholder: 'İşlemi yapan kişinin e-postası', help: 'Trendyol bu e-postayı her işlemde ister (x-executor-user). Panelde kullandığınız e-posta olmalıdır.' },
    ],
    advanced: [{ key: 'storeId', label: 'Mağaza ID (yalnızca birden çok restoranınız varsa)', placeholder: 'Boş bırakın; tek restoran otomatik bulunur' }],
  },
  YEMEKSEPETI: {
    title: 'Yemeksepeti (Partner API)',
    where: 'Yemeksepeti Partner Portal › Tüm Ayarlar › "Shop Integrations Plugin" bölümünde Client ID ve Client Secret oluşturulur. Chain ID ve Vendor ID\'yi Yemeksepeti temsilcinizden alın (ilk sipariş webhook\'la gelirse kendiliğinden öğrenilir).',
    note: 'Not: Yemeksepeti müşteri adı/telefon/adresini maskeli (***) paylaşır; bu bilgiyi uyduramayız. Siparişi, ürünleri ve tutarı görürsünüz.',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'Partner Portal › Shop Integrations Plugin' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'Partner Portal › Shop Integrations Plugin', secret: true },
      { key: 'chainId', label: 'Chain ID (zincir kimliği)', placeholder: 'Yemeksepeti temsilcisinden' },
      { key: 'vendorId', label: 'Vendor ID (restoran kodu)', placeholder: 'Örn. naez' },
    ],
  },
};

export const PlatformApiSettingsTab: React.FC<PlatformApiSettingsTabProps> = ({ onSaveSuccess }) => {
  const [diagOpen, setDiagOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<OnlinePlatformCode>('TRENDYOL');
  const [config, setConfig] = useState<FoodPlatformsConfig>(restaurantDataService.getFoodPlatformsConfig());
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { success: boolean; msg: string; time: string }>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState(onlinePlatformService.getPlatforms());

  useEffect(() => { setPlatforms(onlinePlatformService.getPlatforms()); }, []);

  const current = platforms.find((p) => p.code === activePlatform) || platforms[0];
  const def = FIELDS[current.code];
  const setCred = (key: keyof PlatformCredentials, value: string) =>
    setPlatforms((prev) => prev.map((p) => (p.code === current.code ? { ...p, credentials: { ...p.credentials, [key]: value.trim() } } : p)));

  const handleSaveAll = async () => {
    restaurantDataService.saveFoodPlatformsConfig(config);
    const failures: string[] = [];
    for (const p of platforms) {
      const r = await onlinePlatformService.savePlatformConfig(p.code, { isEnabled: p.isEnabled, storeStatus: p.storeStatus, credentials: p.credentials, webhookSecret: p.webhookSecret });
      if (!r.success) failures.push(`${p.name}: ${r.message}`);
    }
    if (failures.length > 0) { notify.error('Sunucuya Kaydedilemedi', failures.join('\n')); return; }
    notify.success('Ayarlar Sunucuya Kaydedildi', 'Kaydetmek bağlantıyı DOĞRULAMAZ: her platform için "Bağlantıyı Test Et"e basın.');
    if (onSaveSuccess) onSaveSuccess();
  };

  const handleToggleActive = async (code: OnlinePlatformCode) => {
    const p = platforms.find((x) => x.code === code);
    if (!p) return;
    const next = !p.isEnabled;
    const tr = await onlinePlatformService.togglePlatform(code, next);
    if (!tr.success) { notify.error('Platform Durumu Değiştirilemedi', tr.message); return; }
    setPlatforms(onlinePlatformService.getPlatforms());
    const updated = { ...config, trendyol: { ...config.trendyol }, yemeksepeti: { ...config.yemeksepeti } };
    if (code === 'TRENDYOL') updated.trendyol.enabled = next; else updated.yemeksepeti.enabled = next;
    setConfig(updated);
    restaurantDataService.saveFoodPlatformsConfig(updated);
    (next ? notify.success : notify.warning)(next ? `${p.name} Aktif` : `${p.name} Pasif`, next ? 'Siparişler çekilmeye başlandı; sol menüde "Yemek Platformları" görünür.' : 'Sipariş çekme durdu; platform sol menüden ve listelerden gizlendi.');
  };

  const handleStoreStatus = async (code: OnlinePlatformCode, status: StoreAvailabilityStatus) => {
    const r = await onlinePlatformService.setStoreStatus(code, status);
    setPlatforms(onlinePlatformService.getPlatforms());
    await restaurantDataService.setPlatformStoreStatus(code, status !== 'CLOSED');
    (r.success ? notify.info : notify.error)('Mağaza Durumu', r.message);
  };

  const handleTest = async (code: OnlinePlatformCode) => {
    setTestingConnection(code);
    try {
      const result = await onlinePlatformService.testConnection(code, platforms.find((x) => x.code === code)?.credentials);
      setConnectionStatus((prev) => ({ ...prev, [code]: { success: result.success, msg: result.message, time: new Date().toLocaleTimeString('tr-TR') } }));
      (result.success ? notify.success : notify.error)(result.success ? 'Bağlantı Doğrulandı' : 'Doğrulama Başarısız', result.message);
    } catch (e: any) {
      setConnectionStatus((prev) => ({ ...prev, [code]: { success: false, msg: 'Sunucuya erişilemedi: ' + (e?.message || 'bilinmeyen hata'), time: new Date().toLocaleTimeString('tr-TR') } }));
    } finally {
      setTestingConnection(null);
    }
  };

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1800); };
  const input = 'w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#F5C877] select-text';
  const status = connectionStatus[current.code];

  return (
    <div className="space-y-5 font-sans">
      {diagOpen && <OnlineDiagnosticsPanel onClose={() => setDiagOpen(false)} />}

      <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#F5C877] flex items-center justify-center"><Bell className="w-6 h-6" /></div>
          <div>
            <h3 className="text-sm font-bold text-white">Yemek Platformları</h3>
            <p className="text-xs text-[#8E8E98] mt-0.5">Siparişler platformlardan otomatik çekilir. Önce bilgileri girin, kaydedin, "Bağlantıyı Test Et"e basın, sonra platformu Aktif yapın.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer bg-[#141416] px-3.5 py-2.5 rounded-2xl border border-[#2C2C34]">
            <input type="checkbox" checked={config.continuousAlarmUntilAction} onChange={(e) => setConfig((p) => ({ ...p, continuousAlarmUntilAction: e.target.checked }))} className="w-4 h-4" />
            <span className="text-xs font-bold text-white">Sipariş gelince kesintisiz zil</span>
          </label>
          <button type="button" onClick={() => setDiagOpen(true)} className="px-4 py-2.5 bg-[#282830] hover:bg-[#34343E] text-[#F5C877] rounded-2xl text-xs font-black cursor-pointer flex items-center gap-1.5"><Search className="w-3.5 h-3.5" />Gelen İstekler / Tanı</button>
          <button type="button" onClick={handleSaveAll} className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-2xl text-xs font-black flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" />Tümünü Kaydet</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((p) => (
          <div key={p.code} onClick={() => setActivePlatform(p.code)} className={`p-4 rounded-3xl border cursor-pointer transition-all ${activePlatform === p.code ? 'bg-[#1C1C20] border-[#F5C877]/60 shadow-lg' : 'bg-[#18181C] border-[#2C2C34] opacity-90'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-white">{p.name}</div>
                <div className={`text-[11px] font-bold mt-0.5 ${p.isEnabled ? 'text-emerald-400' : 'text-[#8E8E98]'}`}>{p.isEnabled ? 'AKTİF — siparişler çekiliyor' : 'PASİF'}</div>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleActive(p.code); }} className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${p.isEnabled ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-600 text-white'}`}>
                <Power className="w-3.5 h-3.5" />{p.isEnabled ? 'Pasif Yap' : 'Aktif Yap'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] space-y-4">
        <div>
          <h4 className="text-sm font-black text-white">{def.title}</h4>
          <p className="text-[11px] text-[#A0A0AA] mt-1">{def.where}</p>
          {def.note && <p className="text-[11px] text-amber-300/90 mt-1.5">{def.note}</p>}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {def.fields.map((f) => (
            <div key={String(f.key)} className="space-y-1">
              <label className="text-xs font-bold text-slate-300">{f.label}</label>
              <input type={f.secret ? 'password' : 'text'} value={(current.credentials as any)[f.key] || ''} placeholder={f.placeholder} onChange={(e) => setCred(f.key, e.target.value)} className={input} autoComplete="off" />
              {f.help && <p className="text-[10px] text-[#8E8E98]">{f.help}</p>}
            </div>
          ))}
        </div>
        {def.advanced && (
          <details className="rounded-xl border border-[#2C2C34] p-3">
            <summary className="text-xs font-black text-white cursor-pointer">Gelişmiş</summary>
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              {def.advanced.map((f) => (
                <div key={String(f.key)} className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">{f.label}</label>
                  <input type="text" value={(current.credentials as any)[f.key] || ''} placeholder={f.placeholder} onChange={(e) => setCred(f.key, e.target.value)} className={input} />
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => handleTest(current.code)} disabled={testingConnection === current.code} className="px-4 py-2.5 bg-[#282830] hover:bg-[#34343E] text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${testingConnection === current.code ? 'animate-spin' : ''}`} />Bağlantıyı Test Et
          </button>
          <span className="text-[11px] text-[#8E8E98]">Test, ekranda yazdığınız (henüz kaydetmediğiniz) bilgileri de kullanır.</span>
        </div>
        {status && (
          <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${status.success ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1"><b>{status.success ? 'Bağlantı doğrulandı' : 'Bağlantı kurulamadı'}</b> <span className="opacity-70">({status.time})</span><div className="mt-1 break-words">{status.msg}</div></div>
          </div>
        )}
      </div>

      <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] space-y-3">
        <h4 className="text-sm font-black text-white">Mağaza Durumu (platformda siparişe açık / kapalı)</h4>
        <div className="flex items-center gap-1.5 bg-[#141416] p-1.5 rounded-xl border border-[#2C2C34] w-fit">
          {(['OPEN', 'BUSY', 'CLOSED'] as StoreAvailabilityStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => handleStoreStatus(current.code, s)} className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer ${current.storeStatus === s ? (s === 'OPEN' ? 'bg-emerald-600 text-white' : s === 'BUSY' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white') : 'text-[#8E8E98] hover:text-white'}`}>
              {s === 'OPEN' ? 'Açık' : s === 'BUSY' ? 'Yoğun' : 'Kapalı'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#8E8E98]">{current.code === 'TRENDYOL' ? 'Trendyol\'da "Yoğun" modu yoktur; seçerseniz yalnızca kasada işaretlenir (mağaza açık kalır).' : '"Yoğun" 20 dakikalığına geçici kapatma (CLOSED_UNTIL) olarak iletilir.'}</p>
      </div>

      <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] space-y-3">
        <h4 className="text-sm font-black text-white">{current.code === 'YEMEKSEPETI' ? 'Anlık Sipariş Bildirimi (Webhook) — önerilir' : 'Webhook (isteğe bağlı)'}</h4>
        <p className="text-[11px] text-[#8E8E98]">
          {current.code === 'YEMEKSEPETI'
            ? 'Yemeksepeti Partner Portal\'da aşağıdaki adresi sipariş bildirimi (webhook) adresi olarak, gizli anahtarı da "statik token" olarak kaydedin. Kaydetmezseniz siparişler yine 20 saniyede bir çekilir.'
            : 'Trendyol siparişleri webhook gerekmeden çekilir. Yine de webhook kaydettirirseniz aşağıdaki adres ve anahtar kullanılır.'}
        </p>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">Webhook Gizli Anahtarı</label>
          <div className="flex gap-2">
            <input type="text" value={current.webhookSecret || ''} onChange={(e) => setPlatforms((prev) => prev.map((p) => (p.code === current.code ? { ...p, webhookSecret: e.target.value.trim() } : p)))} placeholder="En az 16 karakter" className={input} />
            <button type="button" onClick={() => { const b = new Uint8Array(24); crypto.getRandomValues(b); const v = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join(''); setPlatforms((prev) => prev.map((p) => (p.code === current.code ? { ...p, webhookSecret: v } : p))); }} className="px-4 py-2.5 bg-[#282830] hover:bg-[#34343E] text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap">Rastgele Üret</button>
          </div>
        </div>
        {onlinePlatformService.getWebhookUrls(current.code).length === 0 && <div className="text-[11px] text-amber-300 font-bold">Önce Bulut & Yedekleme bölümünden sunucu adresini girin.</div>}
        {onlinePlatformService.getWebhookUrls(current.code).map((u) => (
          <div key={u.url} className="space-y-1">
            <div className="text-[10px] text-[#A0A0AA]">{u.label}</div>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={u.url} className={input + ' text-emerald-300'} />
              <button type="button" onClick={() => copy(u.url, u.url)} className="px-4 py-2.5 bg-[#282830] hover:bg-[#34343E] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                {copiedKey === u.url ? (<><CheckCheck className="w-4 h-4 text-emerald-400" />Kopyalandı</>) : (<><Copy className="w-4 h-4" />Kopyala</>)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
