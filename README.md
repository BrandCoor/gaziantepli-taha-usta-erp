# Gaziantepli Taha Usta — Restoran POS / ERP

Restoran için kasa (POS), masa/adisyon, mutfak yazıcısı, garson telefonu (PWA), QR menü, cari/toptancı/personel/gider ve Z raporu yönetimi.

> **Durum:** Kod tarafı test edildi; **gerçek işletmede doğrulanmadı.** Fiziksel yazıcı (Afanda 892E), gerçek telefonlar (Android/iPhone), gerçek hosting ve yemek platformu entegrasyonları için kurulumda yapılacak testler [docs/testing.md](docs/testing.md) ve [docs/known-limitations.md](docs/known-limitations.md) içinde listelenmiştir.

## Bileşenler

| Bileşen | Teknoloji | Nerede çalışır |
|---|---|---|
| **Kasa uygulaması** | Electron 45 + React + TypeScript | Windows kasa bilgisayarı |
| **Kalıcı veri deposu** | SQLite (WAL) — `kasa.db` | Kasa bilgisayarı |
| **Bulut API** | PHP 8 + MySQL/MariaDB | cPanel hosting (HTTPS) |
| **Garson uygulaması** | PWA (`/garson/`) | Garsonların telefonu (Android/iPhone, mağaza gerekmez) |
| **QR menü** | Web (`/menu/`) | Müşteri telefonu |
| **Patron paneli** | Web (`/patron/`) | Patronun telefonu/bilgisayarı |

Ayrıntı: [docs/architecture.md](docs/architecture.md)

## Hızlı başlangıç (geliştirici)

```powershell
npm ci                  # bağımlılıklar
npm run lint            # TypeScript denetimi
npm test                # birim testleri (sunucu testleri atlanır)
npm run build           # üretim derlemesi (dist + dist-electron)
npx electron-builder --win --x64   # Windows kurulum paketi → release\
```

Sunucu (PHP/MySQL) testleri için yerel, **izole** test ortamı: [docs/testing.md](docs/testing.md).

## Kurulum (işletme)

1. **Sunucu:** [docs/deployment.md](docs/deployment.md) — cPanel, veritabanı, `config.local.php`, HTTPS.
2. **Kasa:** `GaziantepliTahaUsta-Kurulum-<sürüm>.exe` çalıştırılır; ilk açılışta yönetici hesabı oluşturulur; Restoran & Donanım Ayarları › Bulut & Yedekleme bölümünden sunucu adresi ve **Kasa API Anahtarı** girilir.
3. **Garson telefonları:** [docs/waiter-app.md](docs/waiter-app.md) — kasadan alınan 6 haneli kod veya QR ile eşleştirilir.
4. **Yedek:** [docs/backup-restore.md](docs/backup-restore.md) — otomatik yedek açık gelir; ikinci kopya klasörü (USB/ikinci disk) ayarlanmalıdır.

## Belgeler

- [Mimari ve veri akışı](docs/architecture.md)
- [Veritabanı ve veri konumları](docs/database.md)
- [Güvenlik modeli](docs/security.md)
- [Yedekleme ve geri yükleme](docs/backup-restore.md)
- [Dağıtım (sunucu + kasa)](docs/deployment.md)
- [Garson uygulaması](docs/waiter-app.md)
- [Test komutları ve sonuçları](docs/testing.md)
- [Bilinen sınırlamalar](docs/known-limitations.md)
- [Değişiklik günlüğü](CHANGELOG.md)
- Denetim raporları: [docs/audit/](docs/audit/) (ilk denetim) ve [docs/audit/08-UYGULAMA-DURUMU.md](docs/audit/08-UYGULAMA-DURUMU.md) (bulguların güncel durumu)
