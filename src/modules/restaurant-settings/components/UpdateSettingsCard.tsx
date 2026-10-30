import React, { useEffect, useState } from 'react';
import { updateService, UpdateStatus } from '../../../services/updateService';
import { checkApiCompat, CompatResult } from '../../../services/compat';
import { getApiSyncUrl, isApiSyncConfigured } from '../../../services/restaurantDataService';
import { APP_VERSION } from '../../../services/appVersion';

const STATE_TR: Record<string, string> = {
  disabled: 'Kapalı', idle: 'Beklemede', checking: 'Denetleniyor…', 'up-to-date': 'Güncel', available: 'Yeni sürüm bulundu',
  downloading: 'İndiriliyor', downloaded: 'İndirildi — kuruluma hazır', error: 'Hata (yeniden denenecek)', rejected: 'Paket reddedildi',
};

export const UpdateSettingsCard: React.FC = () => {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  const [feed, setFeed] = useState('');
  const [note, setNote] = useState('');
  const [compat, setCompat] = useState<CompatResult | null>(null);

  useEffect(() => {
    updateService.status().then((s) => { setSt(s); if (s?.feedUrl) setFeed(s.feedUrl); });
    const off = updateService.subscribe(setSt);
    if (isApiSyncConfigured()) checkApiCompat(getApiSyncUrl()).then(setCompat);
    return off;
  }, []);

  if (!updateService.available()) {
    return (
      <div className="p-4 rounded-2xl bg-[#1C1C20] border border-[#2C2C34] text-xs text-[#C4C4CC]">
        <b className="text-white">Güncelleme</b> — Otomatik güncelleme yalnızca Windows kasa uygulamasında çalışır. Garson sayfası kendini otomatik günceller.
      </div>
    );
  }
  return (
    <div className="p-4 rounded-2xl bg-[#1C1C20] border border-[#2C2C34] space-y-3 text-xs text-[#C4C4CC]">
      <div className="flex items-center justify-between">
        <b className="text-white text-sm">Uygulama Güncellemesi</b>
        <span className="font-mono">Sürüm {APP_VERSION}</span>
      </div>
      <div>
        Durum: <b className="text-white">{STATE_TR[st?.state || 'idle']}</b>
        {st?.available ? ` · yeni sürüm ${st.available}` : ''}
        {st?.message ? ` — ${st.message}` : ''}
      </div>
      {st?.notes && <div className="p-2 rounded-lg bg-black/30 whitespace-pre-wrap">{st.notes}</div>}
      <div className="space-y-1">
        <label className="font-bold text-white">Güncelleme adresi (HTTPS)</label>
        <div className="flex gap-2">
          <input
            value={feed}
            onChange={(e) => setFeed(e.target.value)}
            placeholder="Boşsa sunucu adresinizden türetilir: <API>/updates/"
            className="flex-1 bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 font-mono text-white outline-none"
          />
          <button
            onClick={async () => {
              const r = await updateService.setFeed(feed);
              setNote(r.message);
              setSt(await updateService.status());
            }}
            className="px-3 py-2 bg-[#282830] text-white rounded-xl font-bold cursor-pointer"
          >
            Kaydet
          </button>
        </div>
        <div className="text-[11px]">Kaynak: {st?.feedSource || 'yok'}{st?.feedUrl ? ` · ${st.feedUrl}` : ''}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            setNote('Denetleniyor…');
            setSt(await updateService.check());
            setNote('');
          }}
          className="px-3 py-2 bg-[#F5C877] text-slate-950 rounded-xl font-black cursor-pointer"
        >
          Şimdi denetle
        </button>
        {note && <span>{note}</span>}
      </div>
      <div className="pt-2 border-t border-[#2C2C34]">
        Sunucu (API) sürümü:{' '}
        {compat?.info ? <b className="text-white">{compat.info.apiVersion} (şema {compat.info.schemaVersion})</b> : <span>bilinmiyor</span>}
        {compat?.status === 'ok' && <span className="text-emerald-300 font-bold"> · uyumlu</span>}
        {compat && compat.status !== 'ok' && <div className="mt-1 text-amber-300 font-bold">{compat.message}</div>}
      </div>
    </div>
  );
};
