// Renderer yedek servisi + GERÇEK BackupStore (dosya sistemi) uçtan uca. Electron yerine IPC taklidi kullanılır.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BackupStore } from '../electron/backupStore';
import { stubBrowser } from './helpers/browserStub';

let dir: string;
let store: BackupStore;
let svc: any;
let ls: Map<string, string>;
let failSave = false;

beforeEach(async () => {
  vi.resetModules();
  ls = stubBrowser();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-e2e-'));
  store = new BackupStore([dir]);
  failSave = false;
  (globalThis as any).window.electronAPI = {
    isElectron: true,
    invoke: async (channel: string, payload: any) => {
      switch (channel) {
        case 'app-info': return { version: '1.0.0-test', userData: dir, backupDir: dir, secondaryDir: null };
        case 'backup-save': return failSave ? { success: false, error: 'disk dolu (simülasyon)' } : store.save(payload.label, payload.json);
        case 'backup-list': return { success: true, items: store.list(), dir, secondaryDir: null };
        case 'backup-read': return store.read(payload.name);
        default: throw new Error('kanal yok: ' + channel);
      }
    },
    send() {},
  };
  svc = (await import('../src/services/fullBackupService')).fullBackupService;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const seed = () => {
  localStorage.setItem('gtu_pos_completed_orders', JSON.stringify([{ id: 'o1', totalAmount: 100 }, { id: 'o2', totalAmount: 50 }]));
  localStorage.setItem('gtu_erp_customers', JSON.stringify([{ id: 'c1', balance: 500 }]));
  localStorage.setItem('gtu_pos_z_reports', JSON.stringify([{ id: 'z1', zNo: 1 }]));
  localStorage.setItem('CUSTOM_KASA_API_KEY', 'gizli-anahtar');
};

describe('yedek servisi uçtan uca', () => {
  it('yedek al → dosya gerçekten oluşur, doğrulanır, sır içermez', async () => {
    seed();
    const r = await svc.backupNow('elle');
    expect(r.success).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.counts.tamamlanan_adisyonlar).toBe(2);
    const file = fs.readFileSync(path.join(dir, r.name), 'utf8');
    expect(file).not.toContain('gizli-anahtar');
    expect(JSON.parse(file).data['gtu_erp_customers']).toBeTruthy();
  });

  it('yedek → veri kaybı → listeden geri yükle: veri ve sayılar geri gelir, öncesinde güvenlik yedeği alınır', async () => {
    seed();
    const b = await svc.backupNow('elle');
    localStorage.setItem('gtu_pos_completed_orders', '[]');
    localStorage.removeItem('gtu_erp_customers');

    const res = await svc.restoreFromBackupFile(b.name);
    expect(res.success).toBe(true);
    expect(JSON.parse(localStorage.getItem('gtu_pos_completed_orders')!)).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem('gtu_erp_customers')!)[0].balance).toBe(500);
    expect(localStorage.getItem('CUSTOM_KASA_API_KEY')).toBe('gizli-anahtar');
    // geri yükleme öncesi yedek dosyası mevcut
    expect(store.list().some((x) => x.kind === 'geri-yukleme-oncesi')).toBe(true);
    expect(res.backupBefore).toBeTruthy();
  });

  it('geri yükleme öncesi yedek ALINAMAZSA işlem iptal edilir, mevcut veri değişmez', async () => {
    seed();
    const b = await svc.backupNow('elle');
    localStorage.setItem('gtu_pos_completed_orders', JSON.stringify([{ id: 'yeni1' }, { id: 'yeni2' }, { id: 'yeni3' }]));
    failSave = true;
    const res = await svc.restoreFromBackupFile(b.name);
    expect(res.success).toBe(false);
    expect(res.error).toContain('iptal');
    expect(JSON.parse(localStorage.getItem('gtu_pos_completed_orders')!)).toHaveLength(3); // dokunulmadı
  });

  it('bozuk yedek dosyası uygulanmaz', async () => {
    seed();
    fs.writeFileSync(path.join(dir, 'yedek_20260101-000000_elle.json'), '{bozuk');
    const res = await svc.restoreFromBackupFile('yedek_20260101-000000_elle.json');
    expect(res.success).toBe(false);
    expect(JSON.parse(localStorage.getItem('gtu_pos_completed_orders')!)).toHaveLength(2);
  });

  it('başka uygulamanın/yanlış biçimli JSON uygulanmaz', async () => {
    seed();
    const res = await svc.restoreFromJson(JSON.stringify({ hello: 'world' }));
    expect(res.success).toBe(false);
    expect(JSON.parse(localStorage.getItem('gtu_pos_completed_orders')!)).toHaveLength(2);
  });

  it('masaüstü dışında (tarayıcı) yedek DÜRÜSTÇE başarısız döner', async () => {
    delete (globalThis as any).window.electronAPI;
    const r = await svc.backupNow('elle');
    expect(r.success).toBe(false);
    expect(r.error).toContain('masaüstü');
  });
});
