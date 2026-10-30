import React, { useEffect, useRef, useState } from 'react';
import { updateService, UpdateStatus, workState } from '../../services/updateService';
import { checkApiCompat } from '../../services/compat';
import { getApiSyncUrl, isApiSyncConfigured } from '../../services/restaurantDataService';

/**
 * Güncelleme bildirimi (üst orta). Zorla yeniden başlatma YOKTUR:
 *  - normal güncelleme: indirildi → "Şimdi kur" düğmesi (açık adisyon varken pasif), ya da uygulama kapanırken kurulur
 *  - kritik güncelleme: kalıcı uyarı; açık adisyon/ödeme kalmadığı ilk anda (yedek alınarak) kendiliğinden kurulur
 */
export const UpdateBanner: React.FC = () => {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  const [outdated, setOutdated] = useState('');
  const [apiWarn, setApiWarn] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const installing = useRef(false);

  useEffect(() => {
    if (!updateService.available()) return;
    updateService.status().then(setSt);
    return updateService.subscribe(setSt);
  }, []);

  useEffect(() => {
    const h = (e: Event) => setOutdated((e as CustomEvent).detail?.message || 'Bu sürüm sunucu tarafından desteklenmiyor.');
    window.addEventListener('gtu-client-outdated', h);
    return () => window.removeEventListener('gtu-client-outdated', h);
  }, []);

  // Sunucu sürüm uyumu: açılışta ve 30 dakikada bir.
  useEffect(() => {
    const run = async () => {
      if (!isApiSyncConfigured()) return;
      const r = await checkApiCompat(getApiSyncUrl());
      setApiWarn(r.status === 'client-too-old' || r.status === 'api-too-old' ? r.message : '');
    };
    run();
    const t = setInterval(run, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const tryInstall = async () => {
    if (installing.current) return;
    installing.current = true;
    setBusy(true);
    const r = await updateService.installNow();
    setMsg(r.message);
    setBusy(false);
    if (!r.ok) installing.current = false;
  };

  // Kritik güncelleme: güvenli anı bekle (açık adisyon yokken) ve kendiliğinden kur.
  useEffect(() => {
    if (!st || st.state !== 'downloaded' || !st.critical) return;
    const t = setInterval(() => {
      const w = workState();
      if (w.openOrders === 0 && !w.paymentInProgress) void tryInstall();
    }, 20000);
    return () => clearInterval(t);
  }, [st?.state, st?.critical]);

  const stripes: React.ReactNode[] = [];
  const bar = (key: string, tone: 'info' | 'warn' | 'crit', body: React.ReactNode) =>
    stripes.push(
      <div
        key={key}
        className={`px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-3 max-w-3xl ${
          tone === 'crit' ? 'bg-rose-700 border-rose-300 text-white' : tone === 'warn' ? 'bg-amber-500 border-amber-200 text-slate-950' : 'bg-[#1C1C20] border-[#F5C877]/50 text-[#FAF7F2]'
        }`}
      >
        {body}
      </div>
    );

  if (outdated) bar('old', 'crit', <span>⛔ {outdated}</span>);
  if (apiWarn) bar('api', 'warn', <span>⚠ {apiWarn}</span>);

  if (st && !hidden) {
    const w = workState();
    const blocked = w.openOrders > 0 || w.paymentInProgress;
    if (st.state === 'downloading') {
      bar('dl', st.critical ? 'crit' : 'info', <span>⬇ Yeni sürüm {st.available} indiriliyor… %{st.progress ?? 0}</span>);
    } else if (st.state === 'downloaded') {
      bar(
        'ready',
        st.critical ? 'crit' : 'info',
        <>
          <span>
            {st.critical ? '🔒 KRİTİK GÜVENLİK GÜNCELLEMESİ' : '✅ Yeni sürüm hazır'} — {st.available}.{' '}
            {blocked
              ? st.critical
                ? 'Açık adisyonlar kapanınca otomatik kurulacak (veriniz yedeklenir).'
                : 'Açık adisyon varken kurulmaz; uygulamayı kapattığınızda otomatik kurulur.'
              : 'Kurulum için uygulama kısa süre yeniden başlar; veriniz önce yedeklenir.'}
            {msg ? ` ${msg}` : ''}
          </span>
          <button disabled={blocked || busy} onClick={tryInstall} className="px-3 py-1.5 rounded-xl bg-[#F5C877] text-slate-950 font-black disabled:opacity-40 cursor-pointer">
            {busy ? 'Hazırlanıyor…' : 'Şimdi kur'}
          </button>
          {!st.critical && (
            <button onClick={() => setHidden(true)} className="px-2 py-1 rounded-lg bg-black/30 cursor-pointer">Sonra</button>
          )}
        </>
      );
    } else if (st.state === 'rejected') {
      bar('rej', 'crit', <span>⛔ {st.message}</span>);
    } else if (st.state === 'error' && st.kind === 'critical') {
      bar('err', 'warn', <span>⚠ Kritik güncelleme alınamadı: {st.message}</span>);
    } else if (st.state === 'up-to-date' && st.critical) {
      bar('unsup', 'crit', <span>🔒 {st.message}</span>);
    }
  }

  if (stripes.length === 0) return null;
  return <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] flex flex-col gap-2 items-center">{stripes}</div>;
};
