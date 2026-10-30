/**
 * Basit dosya günlüğü (ana süreç). Günlük dosya, 14 gün saklama. Hassas değerler maskelenir.
 * Saf Node: test edilebilir.
 */
import * as fs from 'fs';
import * as path from 'path';

const SENSITIVE = [
  /(x-kasa-key["':\s=]+)[^\s"',}]+/gi,
  /(x-device-token["':\s=]+)[^\s"',}]+/gi,
  /(x-session["':\s=]+)[^\s"',}]+/gi,
  /(authorization["':\s=]+(?:bearer\s+)?)[^\s"',}]+/gi,
  /("?(?:password|parola|pin|secret|apikey|api_key|token)"?\s*[:=]\s*"?)[^\s",}]+/gi,
];

export function maskSecrets(text: string): string {
  let out = text;
  for (const re of SENSITIVE) out = out.replace(re, '$1***');
  return out;
}

export class FileLogger {
  constructor(private dir: string, private keepDays = 14, private now: () => Date = () => new Date()) {}

  private file(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return path.join(this.dir, `kasa-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.log`);
  }

  write(level: 'INFO' | 'WARN' | 'ERROR', message: string, err?: unknown): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const d = this.now();
      let line = `${d.toISOString()} [${level}] ${message}`;
      if (err) line += ' | ' + (err instanceof Error ? `${err.name}: ${err.message}\n${err.stack || ''}` : String(err));
      fs.appendFileSync(this.file(d), maskSecrets(line) + '\n', 'utf8');
      this.prune();
    } catch {
      /* günlük yazılamıyorsa uygulama etkilenmesin */
    }
  }

  info(m: string) { this.write('INFO', m); }
  warn(m: string, e?: unknown) { this.write('WARN', m, e); }
  error(m: string, e?: unknown) { this.write('ERROR', m, e); }

  private prune(): void {
    try {
      const cutoff = this.now().getTime() - this.keepDays * 86400_000;
      for (const f of fs.readdirSync(this.dir)) {
        if (!/^kasa-\d{4}-\d{2}-\d{2}\.log$/.test(f)) continue;
        const full = path.join(this.dir, f);
        if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
      }
    } catch {}
  }

  /** Son N satır (sağlık ekranı için). */
  tail(lines = 50): string[] {
    try {
      const f = this.file(this.now());
      if (!fs.existsSync(f)) return [];
      return fs.readFileSync(f, 'utf8').trimEnd().split('\n').slice(-lines);
    } catch {
      return [];
    }
  }
}
