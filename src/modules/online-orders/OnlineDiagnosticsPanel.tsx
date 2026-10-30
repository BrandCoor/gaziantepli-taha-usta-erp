import React, { useCallback, useEffect, useState } from 'react';
import { onlinePlatformService, Diagnostics, OnlinePlatformCode } from '../../services/onlinePlatformService';

const NAMES: Record<string, string> = { GETIR: 'Getir Yemek', TRENDYOL: 'Trendyol Go Yemek', YEMEKSEPETI: 'Yemeksepeti' };
const BADGE: Record<string, string> = {
  ACCEPTED: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  DUPLICATE: 'bg-sky-600/20 text-sky-300 border-sky-500/40',
  REJECTED: 'bg-rose-600/20 text-rose-300 border-rose-500/40',
  ERROR: 'bg-amber-600/20 text-amber-300 border-amber-500/40',
};
const RESULT_TR: Record<string, string> = { ACCEPTED: 'KABUL', DUPLICATE: 'TEKRAR', REJECTED: 'REDDEDİLDİ', ERROR: 'HATA' };

/** "Sipariş neden gelmedi?" ekranı: platformdan gelen HER istek (kabul/ret) ve nedeni burada görünür. */
export const OnlineDiagnosticsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [pollMsg, setPollMsg] = useState('');
  const [testMsg, setTestMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const r = await onlinePlatformService.getDiagnostics(60);
    if (r.ok && r.data) { setData(r.data); setError(''); } else { setError(r.error || 'Tanı bilgisi alınamadı'); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const pollNow = async () => {
    setPollMsg('Platformlar sorgulanıyor…');
    const r = await onlinePlatformService.pollOrders();
    if (!r.ok) { setPollMsg('Sorgu başarısız: ' + r.error); return; }
    const lines = Object.entries(r.results || {}).map(([k, v]) => `${NAMES[k] || k}: ${v.error ? 'HATA — ' + v.error : v.skipped ? v.skipped : `${v.fetched} sipariş görüldü, ${v.new} yeni`}`);
    setPollMsg(lines.length ? lines.join(' | ') : 'Etkin platform yok.');
    load();
  };

  const test = async (code: OnlinePlatformCode) => {
    setTestMsg((m) => ({ ...m, [code]: { ok: false, text: 'Test ediliyor…' } }));
    const r = await onlinePlatformService.testConnection(code);
    setTestMsg((m) => ({ ...m, [code]: { ok: r.success, text: r.message } }));
  };

  const copy = (txt: string) => { navigator.clipboard?.writeText(txt); setCopied(txt); setTimeout(() => setCopied(''), 1500); };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-5xl bg-[#1C1C20] border border-[#383844] rounded-3xl p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-white">Platform İstekleri ve Tanı</h2>
            <p className="text-[11px] text-[#A0A0AA]">Platformların sunucunuza gönderdiği her istek ve neden kabul edildiği / edilmediği. Parola ve anahtar değerleri burada gösterilmez.</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-[#282830] text-white rounded-xl text-xs font-bold cursor-pointer">Kapat ✕</button>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-bold">{error}</div>}

        {data && data.hiddenOrders > 0 && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-bold">
            ⚠ {data.hiddenOrders} sipariş, platform "pasif" olduğu için sipariş ekranında gizli. Platformu aktif edin.
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          {(data?.platforms || []).map((p) => {
            const urls = onlinePlatformService.getWebhookUrls(p.platform);
            const t = testMsg[p.platform];
            return (
              <div key={p.platform} className="p-3 rounded-2xl bg-[#141416] border border-[#2C2C34] space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-xs">{NAMES[p.platform]}</span>
                  <span className={`px-2 py-0.5 rounded-lg border font-black ${p.enabled ? BADGE.ACCEPTED : 'bg-slate-700/40 text-slate-300 border-slate-500/40'}`}>{p.enabled ? 'AKTİF' : 'PASİF'}</span>
                </div>
                <div className="text-[#C4C4CC] space-y-0.5">
                  <div>Webhook gizli anahtarı: <b className={p.hasSecret ? 'text-emerald-300' : 'text-rose-300'}>{p.hasSecret ? 'kayıtlı' : 'YOK — webhook reddedilir'}</b></div>
                  <div>Son webhook: <b className={p.lastWebhookAt ? 'text-emerald-300' : 'text-amber-300'}>{p.lastWebhookAt || 'Hiç gelmedi'}</b></div>
                  <div>Toplam sipariş: <b className="text-white">{p.orderCount}</b></div>
                </div>
                {urls.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-[#2C2C34]">
                    <div className="text-[10px] text-[#A0A0AA] font-bold">Platforma kaydedilecek adres(ler):</div>
                    {urls.map((u) => (
                      <button key={u.url} onClick={() => copy(u.url)} className="block w-full text-left p-1.5 rounded-lg bg-[#1C1C20] border border-[#2C2C34] cursor-pointer" title="Kopyala">
                        <div className="text-[10px] text-[#A0A0AA]">{u.label}</div>
                        <div className="font-mono text-[10px] text-emerald-300 break-all">{copied === u.url ? '✔ kopyalandı' : u.url}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => test(p.platform)} className="w-full py-1.5 bg-[#282830] hover:bg-[#34343E] text-white rounded-lg font-black cursor-pointer">Bağlantıyı Test Et (gerçek istek)</button>
                {t && <div className={`p-2 rounded-lg font-bold ${t.ok ? 'bg-emerald-950/60 text-emerald-200' : 'bg-rose-950/60 text-rose-200'}`}>{t.text}</div>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={pollNow} className="px-3 py-2 bg-[#F5C877] text-slate-950 rounded-xl text-xs font-black cursor-pointer">Platformlardan şimdi sorgula</button>
          <button onClick={load} className="px-3 py-2 bg-[#282830] text-white rounded-xl text-xs font-bold cursor-pointer">Yenile</button>
          {pollMsg && <span className="text-[11px] text-[#C4C4CC] font-bold">{pollMsg}</span>}
        </div>

        <div className="rounded-2xl border border-[#2C2C34] overflow-hidden">
          <div className="grid grid-cols-[130px_100px_70px_100px_1fr] gap-2 px-3 py-2 bg-[#141416] text-[10px] font-black text-[#A0A0AA] uppercase">
            <span>Zaman</span><span>Platform</span><span>Kaynak</span><span>Sonuç</span><span>Neden / Not</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[#2C2C34]">
            {(data?.log || []).length === 0 && (
              <div className="p-4 text-xs text-[#A0A0AA]">
                Henüz platformdan hiçbir istek gelmedi. Platform panelinde webhook adresini kaydettiğinizden ve gizli anahtarı eşleştirdiğinizden emin olun; platformunuzun hesap yöneticisi adresi sizin yerinize tanımlıyor olabilir.
              </div>
            )}
            {(data?.log || []).map((l) => (
              <div key={l.id}>
                <button onClick={() => setOpen(open === l.id ? null : l.id)} className="w-full grid grid-cols-[130px_100px_70px_100px_1fr] gap-2 px-3 py-2 text-left text-[11px] hover:bg-[#24242A] cursor-pointer">
                  <span className="text-[#C4C4CC] font-mono">{l.created_at}</span>
                  <span className="text-white font-bold">{NAMES[l.platform] || l.platform}</span>
                  <span className="text-[#A0A0AA]">{l.source}</span>
                  <span><span className={`px-1.5 py-0.5 rounded border font-black ${BADGE[l.result] || ''}`}>{RESULT_TR[l.result] || l.result}</span> <span className="text-[#A0A0AA]">{l.http_code}</span></span>
                  <span className="text-[#E4E4E8]">{l.reason}{l.order_ref ? ` · #${l.order_ref}` : ''}</span>
                </button>
                {open === l.id && (
                  <div className="px-3 pb-3 space-y-1.5 bg-[#141416]">
                    <div className="text-[10px] text-[#A0A0AA]">Gelen başlık adları: <span className="font-mono text-[#C4C4CC]">{l.header_names || '—'}</span></div>
                    <pre className="p-2 rounded-lg bg-black/40 text-[10px] text-emerald-200 whitespace-pre-wrap break-all max-h-56 overflow-y-auto">{l.body_sample || '(gövde yok)'}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
