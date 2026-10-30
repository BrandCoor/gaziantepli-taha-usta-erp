import React, { useEffect, useState } from 'react';
import { printerService } from '../../services/printerService';
import type { PrintJob } from '../../services/printQueue';

const typeLabel: Record<string, string> = { KITCHEN: 'Mutfak', BILL: 'Adisyon', CANCEL: 'İptal', Z_REPORT: 'Z Raporu' };
const fmt = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Sağ altta: bekleyen/başarısız fişleri gösterir. Fiş kaybolmaz; kullanıcı elle tekrar deneyebilir. */
export const PrintQueueIndicator: React.FC = () => {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    printerService.startQueueWorker();
    return printerService.queue.subscribe(() => setTick((n) => n + 1));
  }, []);

  const counts = printerService.queue.counts();
  const problem = counts.pending + counts.failed;
  const jobs: PrintJob[] = printerService.queue.list().slice(0, 30);

  if (problem === 0 && !open) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[60] max-w-sm text-xs">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-2 rounded-xl font-black shadow-xl border cursor-pointer ${counts.failed > 0 ? 'bg-rose-600 text-white border-rose-300' : 'bg-amber-500 text-slate-950 border-amber-200'}`}
      >
        🖨️ Yazdırma Kuyruğu: {counts.failed > 0 ? `${counts.failed} BAŞARISIZ` : ''}{counts.failed > 0 && counts.pending > 0 ? ' · ' : ''}{counts.pending > 0 ? `${counts.pending} bekliyor` : ''}
      </button>
      {open && (
        <div className="mt-2 bg-[#1C1C20] border border-[#383844] rounded-2xl p-3 shadow-2xl max-h-96 overflow-y-auto space-y-2">
          {jobs.length === 0 && <div className="text-[#A0A0AA]">Kuyruk boş.</div>}
          {jobs.map((j) => (
            <div key={j.id} className="p-2 rounded-xl bg-[#141416] border border-[#2C2C34] space-y-1">
              <div className="flex justify-between font-bold text-white">
                <span>{typeLabel[j.jobType] || j.jobType} → {j.printerName}{j.isReprint ? ' (kopya)' : ''}</span>
                <span className={j.status === 'PRINTED' ? 'text-emerald-400' : j.status === 'FAILED' ? 'text-rose-400' : 'text-amber-300'}>
                  {j.status === 'PRINTED' ? 'Basıldı' : j.status === 'FAILED' ? 'BAŞARISIZ' : `Bekliyor (${j.attempts}. deneme)`}
                </span>
              </div>
              <div className="text-[#A0A0AA]">{fmt(j.createdAt)}{j.lastError ? ` · ${j.lastError}` : ''}</div>
              <div className="flex gap-2 pt-1">
                {j.status !== 'PRINTED' && (
                  <button className="px-2 py-1 rounded-lg bg-[#F5C877] text-slate-950 font-black cursor-pointer" onClick={() => printerService.queue.retry(j.id)}>Tekrar dene</button>
                )}
                {j.status !== 'PRINTED' && (
                  <button className="px-2 py-1 rounded-lg bg-slate-700 text-white font-bold cursor-pointer" onClick={() => printerService.printJobViaBrowser(j.id)}>Tarayıcıdan yazdır</button>
                )}
                {j.status === 'PRINTED' && (
                  <button className="px-2 py-1 rounded-lg bg-slate-700 text-white font-bold cursor-pointer" onClick={() => printerService.queue.reprint(j.id)}>Tekrar yazdır</button>
                )}
                {j.status !== 'PENDING' && (
                  <button className="px-2 py-1 rounded-lg bg-transparent text-[#A0A0AA] cursor-pointer" onClick={() => printerService.queue.dismiss(j.id)}>Kaldır</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
