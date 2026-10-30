import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fullBackupService, BackupItem, AppInfo } from '../../../services/fullBackupService';
import { notify } from '../../../services/notificationService';

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (t: number) => new Date(t).toLocaleString('tr-TR');
const kindLabel: Record<string, string> = {
  otomatik: 'Otomatik',
  elle: 'Elle',
  'z-kapanis': 'Z kapanışı',
  'geri-yukleme-oncesi': 'Geri yükleme öncesi',
  'bulut-cekme-oncesi': 'Bulut çekme öncesi',
};

/** Tüm işletme verisinin (adisyon, Z, cari, ürün, personel…) dosya yedeği: alma, listeleme, geri yükleme. */
export const FullBackupPanel: React.FC = () => {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [items, setItems] = useState<BackupItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [secondary, setSecondary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const available = fullBackupService.isAvailable();

  const refresh = useCallback(async () => {
    if (!available) return;
    setInfo(await fullBackupService.appInfo());
    const l = await fullBackupService.list();
    if (l) { setItems(l.items); setSecondary(l.secondaryDir); }
  }, [available]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!available) {
    return (
      <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 font-bold">
        Tam dosya yedeği yalnızca masaüstü (kasa) uygulamasında çalışır. Bu ekran tarayıcıda açıldığı için yedek alınamaz.
      </div>
    );
  }

  const doBackup = async () => {
    setBusy(true);
    const r = await fullBackupService.backupNow('elle');
    setBusy(false);
    if (r.success) {
      notify.success('Yedek Alındı ve Doğrulandı', `${r.name} (${fmtSize(r.bytes || 0)}). Adisyon: ${r.counts?.tamamlanan_adisyonlar ?? 0}, Z: ${r.counts?.z_raporlari ?? 0}, Cari hareket: ${r.counts?.cari_hareketleri ?? 0}.${r.error ? ' Uyarı: ' + r.error : ''}`);
    } else {
      notify.error('Yedek Alınamadı', r.error || 'Bilinmeyen hata');
    }
    refresh();
  };

  const doRestore = (json: string, label: string) => {
    notify.confirm({
      title: 'Yedekten Geri Yükle',
      message: `${label}\n\nMevcut tüm veri bu yedekle DEĞİŞTİRİLECEK. İşlemden önce mevcut verinin otomatik yedeği alınır ve kayıt sayıları doğrulanır; sorun olursa önceki veri geri yüklenir.\n\nDevam edilsin mi?`,
      type: 'danger',
      confirmText: 'Evet, Geri Yükle',
      onConfirm: async () => {
        setBusy(true);
        const res = await fullBackupService.restoreFromJson(json);
        setBusy(false);
        if (res.success) {
          notify.success('Geri Yükleme Tamam', 'Kayıt sayıları doğrulandı. Uygulama yeniden yükleniyor…');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          notify.error('Geri Yükleme Başarısız', res.error || 'Bilinmeyen hata');
        }
      },
    });
  };

  const restoreFromList = async (name: string) => {
    const r = await (window as any).electronAPI.invoke('backup-read', { name });
    if (!r?.success) return notify.error('Yedek Okunamadı', r?.error || '');
    doRestore(r.json, `Yedek: ${name}`);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    doRestore(await f.text(), `Dosya: ${f.name}`);
  };

  const auto = fullBackupService.getLastAuto();

  return (
    <div className="p-5 rounded-3xl border border-[#F5C877]/30 bg-[#1C1C20] space-y-4">
      <div>
        <h3 className="text-sm font-black text-white">Tam Veri Yedeği (Dosya)</h3>
        <p className="text-[11px] text-[#A0A0AA]">
          Tüm adisyonlar, Z raporları, cari/toptancı hareketleri, ürünler, personel ve ayarlar yedeklenir. Otomatik yedek: uygulama açılışından 30 sn sonra ve her 6 saatte bir; ayrıca her Z kapanışında.
          Yedek dosyaları kişisel veri ve parola içerir; yalnızca güvendiğiniz kişilerle paylaşın.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
        <div className="p-3 rounded-xl bg-[#141416] border border-[#2C2C34]">
          <div className="text-[#A0A0AA]">Yedek klasörü</div>
          <div className="font-mono text-emerald-300 break-all">{info?.backupDir || '—'}</div>
        </div>
        <div className="p-3 rounded-xl bg-[#141416] border border-[#2C2C34]">
          <div className="text-[#A0A0AA]">İkinci kopya (USB / ikinci disk)</div>
          <div className="font-mono text-emerald-300 break-all">{secondary || 'Tanımlı değil — önerilir'}</div>
        </div>
        <div className="p-3 rounded-xl bg-[#141416] border border-[#2C2C34] sm:col-span-2">
          <div className="text-[#A0A0AA]">Uygulama verisi (güncellemede silinmez)</div>
          <div className="font-mono text-sky-300 break-all">{info?.userData || '—'}</div>
          {auto && <div className={auto.ok ? 'text-emerald-300' : 'text-rose-300'}>Son otomatik yedek: {fmtDate(auto.at)} — {auto.message}</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={doBackup} className="px-4 py-2.5 bg-[#F5C877] text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50">Şimdi Yedek Al</button>
        <button onClick={() => fullBackupService.openFolder()} className="px-4 py-2.5 bg-[#282830] text-white text-xs font-bold rounded-xl cursor-pointer">Klasörü Aç</button>
        <button onClick={async () => { await fullBackupService.chooseSecondary(); refresh(); }} className="px-4 py-2.5 bg-[#282830] text-white text-xs font-bold rounded-xl cursor-pointer">İkinci Kopya Klasörü Seç</button>
        {secondary && <button onClick={async () => { await fullBackupService.clearSecondary(); refresh(); }} className="px-4 py-2.5 text-[#A0A0AA] text-xs rounded-xl cursor-pointer">İkinci kopyayı kaldır</button>}
        <button disabled={busy} onClick={() => fileRef.current?.click()} className="px-4 py-2.5 bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">Dosyadan Geri Yükle…</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {items.length === 0 && <div className="text-[11px] text-[#A0A0AA]">Henüz yedek yok.</div>}
        {items.slice(0, 40).map((b) => (
          <div key={b.name} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#141416] border border-[#2C2C34] text-[11px]">
            <div className="min-w-0">
              <div className="font-bold text-white truncate">{kindLabel[b.kind] || b.kind} · {fmtDate(b.modified)}</div>
              <div className="text-[#A0A0AA] truncate">{b.name} · {fmtSize(b.size)}</div>
            </div>
            <button disabled={busy} onClick={() => restoreFromList(b.name)} className="px-3 py-1.5 bg-slate-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50 flex-shrink-0">Geri Yükle</button>
          </div>
        ))}
      </div>
    </div>
  );
};
