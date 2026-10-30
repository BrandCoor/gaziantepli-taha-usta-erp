/**
 * Kalıcı yazdırma kuyruğu.
 *
 * Amaç: "sipariş kaydedildi" ile "fiş fiziksel olarak basıldı" iki AYRI olaydır.
 *  - Her fiş önce kalıcı olarak kuyruğa yazılır (uygulama kapansa bile kaybolmaz).
 *  - Gerçek donanım sonucu (başarılı/başarısız) kaydedilir; tarayıcı yedeği "başarılı" sayılmaz.
 *  - Başarısız işler üstel geri çekilmeyle otomatik yeniden denenir, sınır aşılırsa FAILED olur ve
 *    kullanıcı elle "tekrar yazdır" yapar.
 *  - Aynı iş aynı anda iki kez gönderilmez (işlemde kilidi).
 */
export type PrintJobStatus = 'PENDING' | 'PRINTED' | 'FAILED';

export interface PrintJob {
  id: string;
  createdAt: number;
  printerId: string;
  printerName: string;
  /** İş oluşturulduğundaki yazıcı yapılandırması (sonradan değişse de aynı hedefe gider). */
  printer?: any;
  jobType: string;
  data: any;
  status: PrintJobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextAttemptAt: number;
  printedAt?: number;
  /** Elle yeniden yazdırmada true: orijinalin kopyasıdır. */
  isReprint?: boolean;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type DeliverFn = (job: PrintJob) => Promise<{ success: boolean; message: string }>;

export const PRINT_QUEUE_KEY = 'gtu_print_queue_v1';

export interface PrintQueueOptions {
  key?: string;
  now?: () => number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  keepPrinted?: number;
  maxJobs?: number;
}

export class PrintQueue {
  private jobs: PrintJob[] = [];
  private inFlight = new Set<string>();
  private listeners = new Set<() => void>();
  private readonly key: string;
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly keepPrinted: number;
  private readonly maxJobs: number;

  constructor(private storage: KeyValueStorage, private deliver: DeliverFn, opts: PrintQueueOptions = {}) {
    this.key = opts.key ?? PRINT_QUEUE_KEY;
    this.now = opts.now ?? Date.now;
    this.maxAttempts = opts.maxAttempts ?? 8;
    this.baseDelayMs = opts.baseDelayMs ?? 5000;
    this.maxDelayMs = opts.maxDelayMs ?? 60000;
    this.keepPrinted = opts.keepPrinted ?? 100;
    this.maxJobs = opts.maxJobs ?? 500;
    this.load();
  }

  private load() {
    try {
      const raw = this.storage.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : [];
      this.jobs = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.jobs = [];
    }
    // Uygulama bir deneme sırasında kapandıysa iş PENDING kalır ve yeniden denenir.
  }

  private persist() {
    // Bekleyen/başarısız işler asla budanmaz; yalnızca eski PRINTED kayıtlar.
    const printed = this.jobs.filter((j) => j.status === 'PRINTED').sort((a, b) => b.createdAt - a.createdAt);
    const drop = new Set(printed.slice(this.keepPrinted).map((j) => j.id));
    this.jobs = this.jobs.filter((j) => !drop.has(j.id));
    if (this.jobs.length > this.maxJobs) {
      const keep = this.jobs.filter((j) => j.status !== 'PRINTED');
      const rest = this.jobs.filter((j) => j.status === 'PRINTED').slice(-Math.max(0, this.maxJobs - keep.length));
      this.jobs = [...keep, ...rest];
    }
    this.storage.setItem(this.key, JSON.stringify(this.jobs));
    this.listeners.forEach((l) => l());
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  list(): PrintJob[] {
    return [...this.jobs].sort((a, b) => b.createdAt - a.createdAt);
  }

  counts() {
    return {
      pending: this.jobs.filter((j) => j.status === 'PENDING').length,
      failed: this.jobs.filter((j) => j.status === 'FAILED').length,
      printed: this.jobs.filter((j) => j.status === 'PRINTED').length,
    };
  }

  enqueue(input: { printerId: string; printerName: string; printer?: any; jobType: string; data: any; maxAttempts?: number; isReprint?: boolean }): PrintJob {
    const t = this.now();
    const job: PrintJob = {
      id: `pj-${t}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: t,
      printerId: input.printerId,
      printerName: input.printerName,
      printer: input.printer,
      jobType: input.jobType,
      data: input.data,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? this.maxAttempts,
      nextAttemptAt: t,
      isReprint: input.isReprint,
    };
    this.jobs.push(job);
    this.persist();
    return job;
  }

  /** Tek deneme yapar. Aynı iş zaten işlemdeyse hiçbir şey yapmaz (çift basım koruması). */
  async process(jobId: string): Promise<PrintJob | undefined> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'PENDING') return job;
    if (this.inFlight.has(jobId)) return job;
    this.inFlight.add(jobId);
    try {
      job.attempts += 1;
      let res: { success: boolean; message: string };
      try {
        res = await this.deliver(job);
      } catch (e: any) {
        res = { success: false, message: e?.message || 'Beklenmeyen yazıcı hatası' };
      }
      if (res.success) {
        job.status = 'PRINTED';
        job.printedAt = this.now();
        job.lastError = undefined;
      } else {
        job.lastError = res.message;
        if (job.attempts >= job.maxAttempts) {
          job.status = 'FAILED';
        } else {
          const delay = Math.min(this.baseDelayMs * 2 ** (job.attempts - 1), this.maxDelayMs);
          job.nextAttemptAt = this.now() + delay;
        }
      }
      this.persist();
      return job;
    } finally {
      this.inFlight.delete(jobId);
    }
  }

  /** Zamanı gelen bekleyen işleri sırayla dener. */
  async processDue(): Promise<number> {
    const due = this.jobs.filter((j) => j.status === 'PENDING' && j.nextAttemptAt <= this.now() && !this.inFlight.has(j.id));
    for (const j of due) await this.process(j.id);
    return due.length;
  }

  /** Başarısız işi elle yeniden dener (deneme sayacı sıfırlanır). */
  async retry(jobId: string): Promise<PrintJob | undefined> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'PRINTED' || this.inFlight.has(jobId)) return job;
    job.status = 'PENDING';
    job.attempts = 0;
    job.nextAttemptAt = this.now();
    this.persist();
    return this.process(jobId);
  }

  /** Basılmış fişin kopyasını yeni iş olarak ekler (açıkça "tekrar yazdır"). */
  async reprint(jobId: string): Promise<PrintJob | undefined> {
    const src = this.jobs.find((j) => j.id === jobId);
    if (!src) return undefined;
    const copy = this.enqueue({ printerId: src.printerId, printerName: src.printerName, printer: src.printer, jobType: src.jobType, data: src.data, isReprint: true });
    return this.process(copy.id);
  }

  /** İşi kuyruktan kaldırır (yalnızca FAILED veya PRINTED). */
  dismiss(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'PENDING') return;
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.persist();
  }
}
