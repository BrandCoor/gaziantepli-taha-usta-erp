# Güvenlik modeli

## 1. Hemen yapılması gerekenler (sizin hesaplarınızda — kod bunları yapamaz)

Bu projenin **Git geçmişinde** gerçek sırlar bulundu. Dosyadan silmek yetmez; geçmişte kalırlar. Depo herkese açıksa durum daha ciddidir (depo görünürlüğünü kontrol edin).

| Sır | Nerede göründü | Yapılacak |
|---|---|---|
| cPanel MySQL parolası | eski `api/config.php` | cPanel › MySQL'de parolayı **değiştirin**; yenisini yalnızca sunucudaki `config.local.php` içine yazın |
| Yemeksepeti / Trendyol / Getir API anahtarları, webhook secret'ları | eski `onlinePlatformService.ts`, `restaurantDataService.ts` | İlgili platform panellerinden **yenileyin / iptal edin** |
| NVIDIA API anahtarı | eski `opencode.json` | NVIDIA hesabınızdan anahtarı **iptal edin** |
| Eski ortak parolalar (`admin/1`, `1453` vb.) | eski kod/SQL | Kullanılmıyor; kasada ilk kurulumda kendi parolanızı belirlersiniz |

Geçmişten silme (isteğe bağlı, **parolaları değiştirdikten sonra**) `git filter-repo` ve zorla push gerektirir; bu bilinçli olarak yapılmadı.

## 2. Yetki modeli

### Bulut API (`security.php`) — varsayılan REDDET

Her eylem bir politikaya bağlıdır; **listede olmayan eylem `kasa` politikasıdır** (yani kapalı):

| Politika | Kim | Örnek eylemler |
|---|---|---|
| `public` | Herkes (hız sınırlı, kısıtlı çıktı) | `health`, `pair_with_code`, `boss_login`, `qr_menu` |
| `device` | Eşleşmiş telefon + PIN oturumu | `verify_waiter_pin` (yalnız cihaz), `get_active_waiters` |
| `device_or_kasa` | Telefon (cihaz+PIN) **veya** kasa | `get_live_state`, `send_order` |
| `kasa` | `X-Kasa-Key` | `push_kasa_state`, `pull_pending_orders`, `ack_orders`, `delete_item`, yazıcı, cari, Z, eşleştirme kodu üretme/iptal… |
| `boss` | İmzalı patron oturumu (`Authorization: Bearer`) | `get_boss_*`, `get_customers_overview`, `change_boss_password` |
| `qr` (masa belirteçli) | Müşteri QR'ı | `qr_table_state`, `qr_send` |
| `webhook` | Platform imzası/anahtarı | `platform_webhook` |

Sırlar (`config.local.php` veya ortam değişkeni): `APP_SECRET` (≥32 karakter, oturum imzası), `KASA_API_KEY` (≥24 karakter). **Boşsa ilgili yol kapalı kalır** (güvensiz varsayılan yok).

### Garson cihazı

1. Kasa `create_pairing_token` ile **sunucuda** 6 haneli kod + QR belirteci üretir (5 dk, **tek kullanımlık**, yalnızca hash saklanır).
2. Telefon kodu girer → sunucu **cihaz anahtarı** (256 bit, yalnızca SHA-256 özeti saklanır) verir. Tahmin/yedek eşleştirme yolu **yoktur** (eskiden "ilk garsonu eşle" davranışı vardı).
3. Telefon PIN girer → sunucu PIN'i **yalnızca o cihazın garsonuna** karşı doğrular; 12 saatlik imzalı oturum verir. PIN telefonda saklanmaz. Hız sınırı: cihaz başına 8, garson başına 10 deneme / 10 dk.
4. Sipariş: kimlik **token'dan** gelir (istemcinin yazdığı garson adı yok sayılır), fiyatlar **sunucuda** hesaplanır.
5. Kasadan eşleşme sıfırlanınca cihaz anahtarı iptal olur; telefon anında 401 alır ve oturumu kapatır. Pasif yapılan garson da giremez.

### QR menü (müşteri)

Masa QR'ı `masa kimliği + HMAC belirteç (qrt)` içerir (kasa üretir). Belirteçsiz/yanlış belirteçle adisyon görülemez ve sipariş verilemez. Yalnızca `ORDER`, `WAITER_CALL`, `BILL_REQUEST` kabul edilir; IP ve masa başına hız sınırı vardır. QR görseli **yerelde** üretilir (üçüncü taraf servise gönderilmez).

### Patron paneli

Parola `password_hash` ile saklanır (eski düz metin kayıt ilk girişte yükseltilir). 5 hatalı deneme / 15 dk hız sınırı, 8 saatlik imzalı oturum, en az 8 karakterli yeni parola.

### Kasa uygulaması kullanıcıları

- **Varsayılan hesap yok.** İlk açılışta yönetici hesabı oluşturulur (zayıf parolalar reddedilir).
- Parolalar **PBKDF2-SHA256 (150 000 iterasyon)**; eski düz metin kayıt ilk başarılı girişte yükseltilir. Kullanıcı ekranında parola gösterilmez.
- 5 hatalı denemede 30 sn kilit (katlanır, en çok 15 dk).
- Roller ve izinler gerçekten uygulanır (`ROLE_PERMISSIONS`): **iptal / ikram / adisyon iptali** için `POS_CANCEL`, ayarlar için `SETTINGS_MANAGE`, kullanıcılar için `USERS_MANAGE`, raporlar için `REPORTS_VIEW`… Yönetici hepsine sahiptir. Kasiyer varsayılan olarak yalnızca adisyon/tahsilat yapar. Son aktif yönetici silinemez/başka role çevrilemez.
- Yetki kontrolü ekranda **ve** içerik düzeyinde (menüde gizlenir, URL ile açılsa bile içerik gelmez).

## 3. Kasa uygulaması (Electron)

- `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, izin listeli `preload` köprüsü; IPC gönderen doğrulanır; yeni pencere/dış gezinme engellenir.
- Üretim derlemesinde **CSP** (`script-src 'self'`, harici betik yok).
- Yerel sunucu **yalnızca `127.0.0.1:4545`**; `Host` ve `Origin` doğrulanır (DNS-rebinding/CSRF koruması); yazıcı hedefi yalnızca özel/yerel IP olabilir; sahte arama simülasyonu üretimde kapalı.
- Tek örnek kilidi (iki kasa penceresi aynı veriyi bozmasın).
- Yedeklere sır/token girmez (`CUSTOM_KASA_API_KEY`, cihaz belirteçleri hariç tutulur).

## 4. Ağ

- API ve web sayfaları **HTTPS zorunlu** (`.htaccess` yönlendirir, HSTS gönderir). Kasa internetten **dışarıdan erişilebilir olmak zorunda değildir**: kasa sunucuya bağlanan istemcidir. Port yönlendirme, güvenlik duvarını kapatma veya veritabanını internete açma **gerekmez ve önerilmez**.
- CORS `*` kalmıştır çünkü Electron penceresi `file://` kaynağıdır (`Origin: null`); kimlik doğrulama çerezle değil **başlıkla** yapıldığı için CSRF yüzeyi oluşturmaz.
- PHP hata ayrıntıları istemciye gösterilmez; yalnızca sunucu loguna yazılır. Dışarıdan okunabilir JSON veri dosyası ve JSON yedek modu **kaldırıldı**.

## 5. Bilinen artık riskler

- Garson **PIN'leri** (4 hane) bulut veritabanında düz metindir (kasa gönderir). Cihaz anahtarı + hız sınırı + oturum ile korunur; veritabanı ele geçirilirse PIN'ler görünür. Gelecek iş: PIN'i hash'lemek.
- Yedek dosyaları **şifresizdir** ve kişisel veri/parola özeti içerir. Disk şifreleme (BitLocker) ve yedeğin güvenli yerde tutulması önerilir.
- Kasa verisi `%APPDATA%` altında düz metindir (Windows kullanıcı hesabı güvenliğine dayanır).
- Kurulum paketi **kod imzalı değildir** (Windows SmartScreen uyarı verebilir).
- Bağımlılık denetimi: 2 *orta* seviye bildirim kaldı (`exceljs` → `uuid`; yalnızca `uuid` v3/v5/v6'nın `buf` parametresini etkiler, `exceljs` bunu kullanmaz).
