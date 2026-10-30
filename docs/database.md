# Veritabanı ve veri konumları

## Kasa bilgisayarı

| Ne | Nerede | Not |
|---|---|---|
| **Asıl veri deposu** | `%APPDATA%\gaziantepli-taha-usta\data\kasa.db` (SQLite, WAL, `synchronous=FULL`) | Her yazma anında COMMIT edilir; süreç öldürülse bile işlenmiş yazmalar korunur (testle doğrulandı) |
| Arayüz önbelleği | Chromium `Local Storage` (aynı klasör) | Hızlı eşzamanlı okuma için; silinse/bozulsa bile açılışta SQLite'tan geri yüklenir |
| Dosya yedekleri | `Belgelerim\GaziantepliTahaUsta-Yedekler\` (+ isteğe bağlı ikinci klasör) | [backup-restore.md](backup-restore.md) |
| Günlükler | `%APPDATA%\gaziantepli-taha-usta\logs\kasa-YYYY-AA-GG.log` | 14 gün saklanır, gizli değerler maskelenir |

`%APPDATA%\gaziantepli-taha-usta` kurulum klasöründe **değildir**; yeniden kurulum/güncelleme/kaldırmada **silinmez** (kurulum paketi `deleteAppDataOnUninstall:false`; kurulum–üzerine kurulum–kaldırma döngüsü test bilgisayarında denendi, veri klasörü yerinde kaldı).

### SQLite şeması (`kasa.db`)

```
kv(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)   -- uygulama verisi (JSON metin)
meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)                              -- schema_version = 1
```

Şu an uygulama verisi anahtar-değer olarak tutulur (her anahtar bir koleksiyonun JSON'u). Bu bilinçli bir ara adımdır: mevcut iş mantığını bozmadan, **dayanıklılığı** sağlar. İlişkisel tabloya (adisyon satırı, ödeme vb.) geçiş [known-limitations.md](known-limitations.md) içinde "gelecek iş" olarak yazılıdır.

Başlıca anahtarlar (önek `gtu_`):

| Anahtar | İçerik |
|---|---|
| `gtu_pos_tables`, `gtu_pos_sections` | Masalar (açık adisyonlar dahil), bölümler |
| `gtu_pos_products`, `gtu_pos_categories` | Menü |
| `gtu_pos_waiters`, `gtu_pos_printers` | Garsonlar, yazıcılar |
| `gtu_pos_completed_orders` | Kapanmış adisyon arşivi |
| `gtu_pos_z_reports`, `gtu_pos_cancel_logs` | Z raporları, iptal kayıtları (silinmez; Z'ye bağlanır) |
| `gtu_erp_customers`, `gtu_erp_customer_transactions` | Müşteri ve cari hareketler |
| `gtu_erp_suppliers`, `gtu_erp_supplier_transactions` | Toptancı ve hareketler |
| `gtu_erp_expenses`, `gtu_erp_employees`, `gtu_erp_users` | Gider, personel, kasa kullanıcıları (parolalar PBKDF2 hash) |
| `gtu_processed_incoming_ids` | İşlenmiş garson/QR sipariş kimlikleri (çift işleme koruması) |
| `gtu_print_queue_v1` | Kalıcı yazdırma kuyruğu |
| `CUSTOM_API_SYNC_URL`, `CUSTOM_KASA_API_KEY` | Sunucu adresi ve kasa anahtarı (**yedeğe girmez**) |

### Eski sürümden geçiş

İlk açılışta SQLite boşsa ve arayüzde (Chromium) veri varsa, veri **tek işlemde içe aktarılır**; SQLite doluysa içe aktarma **reddedilir** (mevcut veri ezilmez). Senaryo gerçek Electron'da test edilir (`tools/dev/e2e-durable.cjs`).

## Bulut (MySQL / MariaDB)

Tablolar API ilk çağrıldığında **kendiliğinden** oluşturulur (`config.php › ensureDatabaseTables`); elle SQL içe aktarmak gerekmez. Şema sürümü `ayarlar.schema_version` içinde tutulur ve göçler (`runSchemaMigrations`) **yalnızca bir kez** ve yalnızca **ekleme** yaparak çalışır.

Kullanılan başlıca tablolar: `ayarlar`, `bolumler`, `masalar`, `kategoriler`, `urunler`, `personeller`, `musteriler`, `cari_hareketler`, `toptancilar`, `toptanci_hareketler`, `giderler`, `z_raporlari`, `tamamlanan_adisyonlar`, **`siparisler`** (gelen sipariş kuyruğu; `id` = `ord-<clientOrderId>` → tekrar engelleme), **`cihazlar`** (eşleşmiş telefonlar; yalnızca anahtarın SHA-256 özeti), `online_platforms`, `online_siparisler`, `audit_logs`, `rate_limits`.

Zaman: PHP `Europe/Istanbul`, MySQL oturumu `+03:00`; eşleştirme süreleri aynı saatle karşılaştırılır.

Not: `categories`, `products`, `tables`, `orders`… gibi bazı ek tablolar eski şema kalıntısıdır ve kullanılmaz (sonraki temizlik işi).

## Para ve tarih kuralları

- Tutarlar kuruşa yuvarlanır (`round2`); Z raporu toplamları float birikimi taşımaz.
- **İş günü:** yerel saat, **05:00** gün değişimi (`src/utils/businessDate.ts`). 00:00–04:59 arası satış bir önceki iş gününe yazılır. Tek tanım tüm uygulamada kullanılır.
- KDV: tek oran **%10** (ürün bazlı KDV yoktur — bkz. sınırlamalar).
- Giderler ve toptancı hareketleri bir Z'ye girdikten sonra sonraki Z'de **tekrar sayılmaz**.
