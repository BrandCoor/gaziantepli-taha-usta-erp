import { describe, it, expect } from 'vitest';
import { PrintQueue, PrintJob } from '../src/services/printQueue';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const base = { printerId: 'p1', printerName: 'Mutfak', jobType: 'KITCHEN', data: { x: 1 } };

describe('PrintQueue', () => {
  it('başarılı basım PRINTED olur ve bir kez teslim edilir', async () => {
    let calls = 0;
    const q = new PrintQueue(mem(), async () => { calls++; return { success: true, message: 'ok' }; });
    const j = q.enqueue(base);
    const r = await q.process(j.id);
    expect(r?.status).toBe('PRINTED');
    expect(calls).toBe(1);
    await q.process(j.id); // tekrar çağrı yeni basım yapmaz
    expect(calls).toBe(1);
  });

  it('yazıcı kapalıysa iş kaybolmaz: PENDING kalır, hata kaydedilir', async () => {
    const q = new PrintQueue(mem(), async () => ({ success: false, message: 'Yazıcıya ulaşılamadı' }));
    const j = q.enqueue(base);
    const r = await q.process(j.id);
    expect(r?.status).toBe('PENDING');
    expect(r?.attempts).toBe(1);
    expect(r?.lastError).toContain('ulaşılamadı');
    expect(q.counts().pending).toBe(1);
  });

  it('geri çekilme süresi dolmadan yeniden denenmez; dolunca denenir ve başarılı olur', async () => {
    let now = 1000;
    let ok = false;
    let calls = 0;
    const q = new PrintQueue(mem(), async () => { calls++; return ok ? { success: true, message: 'ok' } : { success: false, message: 'x' }; }, { now: () => now, baseDelayMs: 5000 });
    const j = q.enqueue(base);
    await q.process(j.id); // 1. deneme başarısız
    expect(calls).toBe(1);
    now += 1000;
    await q.processDue(); // henüz erken
    expect(calls).toBe(1);
    ok = true;
    now += 5000;
    await q.processDue();
    expect(calls).toBe(2);
    expect(q.list()[0].status).toBe('PRINTED');
  });

  it('deneme sınırı aşılınca FAILED olur; elle tekrar dene çalışır', async () => {
    let now = 0;
    let ok = false;
    const q = new PrintQueue(mem(), async () => (ok ? { success: true, message: 'ok' } : { success: false, message: 'hata' }), { now: () => now, maxAttempts: 3, baseDelayMs: 1 });
    const j = q.enqueue(base);
    for (let i = 0; i < 5; i++) { now += 100; await q.processDue(); }
    expect(q.list()[0].status).toBe('FAILED');
    expect(q.counts().failed).toBe(1);
    ok = true;
    const r = await q.retry(j.id);
    expect(r?.status).toBe('PRINTED');
  });

  it('aynı iş eşzamanlı iki kez tetiklense de tek basım yapılır (çift basım koruması)', async () => {
    let calls = 0;
    const q = new PrintQueue(mem(), async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { success: true, message: 'ok' }; });
    const j = q.enqueue(base);
    await Promise.all([q.process(j.id), q.process(j.id), q.process(j.id)]);
    expect(calls).toBe(1);
  });

  it('uygulama yeniden başlayınca bekleyen işler korunur', async () => {
    const st = mem();
    const q1 = new PrintQueue(st, async () => ({ success: false, message: 'kapalı' }));
    q1.enqueue(base);
    const q2 = new PrintQueue(st, async () => ({ success: true, message: 'ok' }));
    expect(q2.counts().pending).toBe(1);
    await q2.processDue();
    expect(q2.counts().printed).toBe(1);
  });

  it('deliver istisna fırlatırsa iş kaybolmaz', async () => {
    const q = new PrintQueue(mem(), async () => { throw new Error('boom'); });
    const j = q.enqueue(base);
    const r = await q.process(j.id);
    expect(r?.status).toBe('PENDING');
    expect(r?.lastError).toBe('boom');
  });

  it('reprint orijinali değiştirmeden kopya iş oluşturur', async () => {
    let calls = 0;
    const q = new PrintQueue(mem(), async (job: PrintJob) => { calls++; return { success: true, message: job.isReprint ? 'kopya' : 'orijinal' }; });
    const j = q.enqueue(base);
    await q.process(j.id);
    await q.reprint(j.id);
    expect(calls).toBe(2);
    expect(q.list().filter((x) => x.isReprint)).toHaveLength(1);
  });

  it('bekleyen/başarısız işler budanmaz, eski PRINTED kayıtlar budanır', async () => {
    const q = new PrintQueue(mem(), async () => ({ success: true, message: 'ok' }), { keepPrinted: 2 });
    for (let i = 0; i < 5; i++) { const j = q.enqueue(base); await q.process(j.id); }
    expect(q.counts().printed).toBe(2);
    const failing = new PrintQueue(mem(), async () => ({ success: false, message: 'x' }), { keepPrinted: 1 });
    for (let i = 0; i < 4; i++) failing.enqueue(base);
    expect(failing.counts().pending).toBe(4);
  });
});
