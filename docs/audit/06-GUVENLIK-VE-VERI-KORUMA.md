> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

# 06 — Güvenlik ve Veri Koruma

Gerçek parola/anahtar değerleri bu belgeye yazılmamıştır.

## 1. Gizli bilgiler
| Konum | Tür | Risk | Önlem |
|---|---|---|---|
| `cpanel-yuklenecekler/api/config.php` | MySQL kullanıcı + parola (gerçek görünüyor) | KRİTİK | Parolayı **değiştir**; `config.local.php` (repo dışı) veya sunucu ortam değişkeni |
| `src/services/onlinePlatformService.ts` (~99–142) | Platform API/secret anahtarları, webhook secret'ları | KRİTİK | İlgili panellerden **yenile**; kodda yalnızca boş şablon |
| `api/db_test.php` | DB kullanıcı adını ekrana basar | ORTA | Üretimde sil |
| `.claude/settings.local.json`, `prompt.txt`, `opencode.json` | Araç yapılandırması | DÜŞÜK | Depodan çıkar, `.gitignore` |
| `prisma/dev.db-journal` | Binary SQLite artığı izleniyor | ORTA (içerik doğrulanmadı) | Depodan çıkar; içeriğini yerelde inceleyin |

Dosyadan silmek yeterli değildir: Git geçmişinde (32 commit, 3 uzak dal) kalır. Parolalar **iptal/yenilenmeli**; ancak ondan sonra isterseniz geçmiş temizliği (force push gerektirir → ayrı onayınızla) yapılır. Repo herkese açıksa durum daha ciddidir; görünürlüğünü kontrol edin.

## 2. Kimlik doğrulama ve yetkilendirme
- PHP API: kimlik doğrulama yok (B-02). Hedef: kısa ömürlü imzalı token (HMAC/JWT), cihaz kaydı, rol bazlı yetki, tüm uçlarda sunucu kontrolü.
- Patron girişi: hash'li parola, oran sınırlama, ikinci faktör (isteğe bağlı).
- Garson: PIN düz metin ve `get_active_waiters` ile herkese açık → PIN'ler hash'lenmeli, listeye PIN dönmemeli.
- Yerel kullanıcı parolaları düz metin ve ekranda görünüyor → hash (bcrypt/argon2), parola gösterme kaldırılmalı, varsayılan hesaplar ilk kurulumda zorunlu değiştirilmeli.
- Yetki bayrakları (`canVoidItem`, `canDiscount`, `canGift`) uygulanmıyor → sunucu tarafında zorunlu kıl.

## 3. Ağ güvenliği
- CORS `*` her yerde → yalnızca bilinen kaynaklar.
- Yerel Express: `127.0.0.1` ya da yetkili cihaz token'ı; yazıcı IP'si yalnızca kayıtlı yazıcılar.
- Webhook: secret tanımlıysa imza zorunlu.
- Girdi: PDO hazırlanmış sorgular kullanılıyor (olumlu). `delete_item` tablo adını beyaz liste ile alıyor (olumlu) ama yetkisiz.
- XSS: garson/patron/menü sayfalarında toplam 72 `innerHTML` kullanımı; ürün/müşteri/platform verisi kaçışlanmadan basılıyorsa risk. Kasa tarafında `nodeIntegration` olduğu için XSS = bilgisayar ele geçirme (B-12). Tek tek doğrulanmadı.

## 4. Veritabanı ve veri bütünlüğü
- Hedef: tek SQLite (WAL), yabancı anahtarlar açık, para kuruş tamsayı, UNIQUE (`clientOrderId`, sipariş no/gün), silme yerine iptal+denetim, değişmez Z.
- Mevcut hata: MySQL `push` "gönderilmeyeni sil" davranışı → kaldırılmalı.

## 5. Yedekleme ve geri yükleme
- Mevcut: yalnızca ayar JSON'u (B-10).
- Hedef: günlük + her Z sonrası otomatik SQLite yedeği (SQLite backup API), son 30 gün rotasyon, ikinci diske/USB'ye kopya, şifreli isteğe bağlı; geri yükleme öncesi mevcut veriyi otomatik yedekle; geri yükleme doğrulaması (kayıt sayısı, bakiye toplamı).

## 6. Veri konumu ve göç (kalıcı dizin)
- Mevcut: Electron `userData` altında localStorage (yaklaşık `%APPDATA%\gaziantepli-taha-usta\Local Storage\leveldb`; kesin yol çalıştırılarak doğrulanmalı). Kurulum klasöründe değil — olumlu; ancak dev (`http://localhost:3000`) ve üretim (`file://`) farklı depolardır.
- Öneri: `C:\ProgramData\RYMedya\GaziantepliTahaUsta\` (veri + yedek + log). ProgramData'da standart kullanıcıya yazma izni için ACL ayarı gerekir; alternatif `%APPDATA%`. **Önce mevcut verinin yeri doğrulanacak, taşıma yapılmayacak.**
- Göç adımları: (1) kapalıyken profil klasörünü kopyala; (2) salt-okunur dışa aktarım aracı; (3) SQLite'a içe aktar; (4) sayı/bakiye mutabakat raporu; (5) onay sonrası yeni sürüme geç; (6) eski veri en az 30 gün silinmez; (7) geri dönüş: eski sürüm + eski profil.

## 7. Güvenli güncelleme
- Kod imzalama, güncelleme kanalı (electron-updater), sürüm göçü numaralandırılmış ve geri alınabilir, güncelleme öncesi otomatik yedek, NSIS `deleteAppDataOnUninstall: false`.
- Müşteri kurulumu şu an `npm install` + build (kurulum betiği) → son kullanıcıda kaynak koda bağımlı; imzalı kurulum paketine geçilmeli.

## 8. Loglama ve gizlilik
- Müşteri telefon/adres, personel IBAN/maaş verisi açık dolaşıyor; bulut senkronunda şifrelenmiyor. Alanlar için erişim kontrolü ve gerekirse KVKK kapsamında aydınlatma/saklama süresi.
- Garson sayfasındaki sabit alan adları nedeniyle veri başka sunucuya gidebilir (B-22).

## 9. Mevcut verinin korunması için kurallar (uygulama sırasında)
Yedeksiz işlem yok; üretimde test yok; tek seferde toplu güncelleme/silme yok; migration kuru çalıştırma + mutabakat; her aşamada geri dönüş planı; üretim veritabanı sıfırlanmaz.
