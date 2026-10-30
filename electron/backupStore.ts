/**
 * Dosya tabanlı yedek deposu (ana süreç). Saf Node; Electron'a bağımlı değildir (test edilebilir).
 *
 * Güvenceler:
 *  - Yazma ATOMİKTİR: önce .tmp dosyasına yazılır, doğrulanır, sonra yeniden adlandırılır.
 *  - Yazılan dosya geri okunur, JSON olarak ayrıştırılır ve SHA-256 özeti karşılaştırılır.
 *  - Dosya adları doğrulanır (yol gezinmesi / path traversal mümkün değil).
 *  - Döndürme: otomatik yedeklerden son N tanesi tutulur; elle/Z/geri-yükleme-öncesi yedekler asla otomatik silinmez.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface BackupInfo {
  name: string;
  size: number;
  modified: number;
  kind: string;
}

export interface SaveResult {
  success: boolean;
  name?: string;
  path?: string;
  bytes?: number;
  sha256?: string;
  verified?: boolean;
  error?: string;
}

const NAME_RE = /^yedek_(\d{8}-\d{6})_([a-z0-9-]{1,40})\.json$/;
const AUTO_KINDS = new Set(['otomatik', 'bulut-cekme-oncesi']);

export function sanitizeLabel(label: string): string {
  const l = (label || 'elle')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return l || 'elle';
}

function stamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export class BackupStore {
  constructor(private dirs: string[], private keepAuto = 60, private now: () => Date = () => new Date()) {}

  /** Birincil klasör + (varsa) ikincil kopya klasörleri. */
  setDirs(dirs: string[]) {
    this.dirs = dirs.filter(Boolean);
  }

  primaryDir(): string {
    return this.dirs[0];
  }

  save(label: string, json: string): SaveResult {
    if (!this.dirs.length) return { success: false, error: 'Yedek klasörü tanımlı değil' };
    try {
      JSON.parse(json); // bozuk veriyi yedek diye yazma
    } catch {
      return { success: false, error: 'Yedeklenecek veri geçerli JSON değil' };
    }
    const kind = sanitizeLabel(label);
    const name = `yedek_${stamp(this.now())}_${kind}.json`;
    const sha = crypto.createHash('sha256').update(json, 'utf8').digest('hex');
    let primaryPath = '';
    let bytes = 0;
    const errors: string[] = [];

    this.dirs.forEach((dir, idx) => {
      try {
        fs.mkdirSync(dir, { recursive: true });
        const finalPath = path.join(dir, name);
        const tmp = finalPath + '.tmp';
        fs.writeFileSync(tmp, json, 'utf8');
        const back = fs.readFileSync(tmp, 'utf8');
        const backSha = crypto.createHash('sha256').update(back, 'utf8').digest('hex');
        if (backSha !== sha) throw new Error('Doğrulama başarısız (özet uyuşmuyor)');
        JSON.parse(back);
        fs.renameSync(tmp, finalPath);
        if (idx === 0) {
          primaryPath = finalPath;
          bytes = Buffer.byteLength(json, 'utf8');
        }
        this.rotate(dir);
      } catch (e: any) {
        errors.push(`${dir}: ${e?.message || e}`);
      }
    });

    if (!primaryPath) return { success: false, error: errors.join(' | ') || 'Yazılamadı' };
    return { success: true, name, path: primaryPath, bytes, sha256: sha, verified: true, error: errors.length ? `İkincil kopya hatası: ${errors.join(' | ')}` : undefined };
  }

  list(): BackupInfo[] {
    const dir = this.primaryDir();
    if (!dir || !fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map((name) => {
        const m = NAME_RE.exec(name);
        if (!m) return null;
        const st = fs.statSync(path.join(dir, name));
        return { name, size: st.size, modified: st.mtimeMs, kind: m[2] } as BackupInfo;
      })
      .filter((x): x is BackupInfo => !!x)
      .sort((a, b) => b.modified - a.modified || (a.name < b.name ? 1 : -1));
  }

  /** Yalnızca listede bulunan, doğrulanmış dosya adı okunur. */
  read(name: string): { success: boolean; json?: string; error?: string } {
    if (!NAME_RE.test(name)) return { success: false, error: 'Geçersiz yedek adı' };
    const file = path.join(this.primaryDir(), name);
    if (path.dirname(file) !== path.resolve(this.primaryDir()) && path.dirname(file) !== this.primaryDir()) {
      return { success: false, error: 'Geçersiz yol' };
    }
    if (!fs.existsSync(file)) return { success: false, error: 'Yedek bulunamadı' };
    try {
      const json = fs.readFileSync(file, 'utf8');
      JSON.parse(json);
      return { success: true, json };
    } catch (e: any) {
      return { success: false, error: 'Yedek dosyası bozuk: ' + (e?.message || e) };
    }
  }

  private rotate(dir: string) {
    const files = fs
      .readdirSync(dir)
      .map((name) => ({ name, m: NAME_RE.exec(name) }))
      .filter((x) => x.m && AUTO_KINDS.has(x.m[2]))
      .map((x) => ({ name: x.name, t: fs.statSync(path.join(dir, x.name)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(this.keepAuto).forEach((f) => {
      try {
        fs.unlinkSync(path.join(dir, f.name));
      } catch {}
    });
  }
}
