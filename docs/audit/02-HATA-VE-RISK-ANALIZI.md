> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

# 02 — Hata ve Risk Analizi

Not: Gerçek parola/anahtarlar bu belgeye kopyalanmamıştır. "Kanıt", yalnızca okunan koddur; hiçbir bulgu çalıştırılarak doğrulanmadı. Doğrulanamayanlar en altta "Şüpheler" bölümündedir.

---

## B-01 — Asıl veri deposu tarayıcı localStorage'ı
- **Modül:** Veri katmanı. **Dosya:** `src/services/restaurantDataService.ts` (`STORAGE_KEYS`, `saveTables`, `completeTablePayment`), `src/services/dataService.ts`.
- **Açıklama:** Siparişler, arşiv, Z raporları, cari, gider, personel hareketleri localStorage'da JSON olarak tutuluyor. Prisma/SQLite hiç bağlı değil (kodda `PrismaClient` yok).
- **Etki:** İşlemsel (ACID) garanti yok; profil bozulması/temizlenmesi tüm geçmişi siler; ~5–10 MB kota; yedek yok (B-10); eşzamanlı yazımda son yazan kazanır.
- **Öncelik:** KRİTİK.
- **Çözüm:** Kasa sürecinde (Electron main) tek yetkili SQLite; renderer yalnızca API ile konuşur. Migration planı (08 değil, 04/06 belgeleri).
- **Test:** Kapatma/çökme sonrası veri bütünlüğü, kota testi, göç sonrası kayıt sayısı/bakiye karşılaştırması.

## B-02 — PHP API'de kimlik doğrulama yok
- **Modül:** Bulut API. **Dosya:** `cpanel-yuklenecekler/api/index.php` — `push_kasa_state`, `get_all_erp_data`, `delete_item`, `get_active_waiters`, `get_boss_summary`, `get_boss_z_reports`, `get_customers_overview`, `save_printer`, `cancel_item` vb.
- **Kanıt:** Bu işlemlerin hiçbirinde token/oturum kontrolü yok; `boss_login` token üretiyor (`'BOSS-'.md5(...)`) ama hiçbir yerde doğrulanmıyor. `Access-Control-Allow-Origin: *`.
- **Etki:** URL'yi bilen herkes tüm müşteri/personel (IBAN, maaş, PIN) verisini okuyabilir; `delete_item` ile Z raporu ve tamamlanan adisyon dahil kayıtları silebilir; `push_kasa_state` ile tüm veriyi (içermeyen kayıtları `DELETE ... NOT IN` ile) sildirebilir.
- **Öncelik:** KRİTİK.
- **Çözüm:** Her uçta sunucu tarafı oturum/token (imzalı, süreli), rol kontrolü, CORS kısıtı, silme yerine "soft delete"+denetim kaydı.
- **Test:** Token'sız her uç 401 dönmeli; rol bazlı yetki matrisi testi.

## B-03 — Gizli bilgiler repoda
- **Dosyalar:** `cpanel-yuklenecekler/api/config.php` (gerçek görünen MySQL kullanıcı/parola gömülü), `api/db_test.php` (DB kullanıcı adını ekrana basar), `src/services/onlinePlatformService.ts` satır ~99–142 (Trendyol/Getir/Yemeksepeti API anahtar/secret/webhook secret), `restaurantDataService.ts` varsayılan platform ayarları, `.claude/settings.local.json` izleniyor.
- **Etki:** Repo erişimi olan veya geçmişi klonlayan herkes DB'ye ve platform hesaplarına erişebilir. Dosyadan silmek yetmez: **Git geçmişinde kalır.**
- **Öncelik:** KRİTİK.
- **Çözüm (sıra önemli):** (1) cPanel DB parolasını **hemen değiştir**; (2) platform API anahtarlarını/secret'larını ilgili panellerden **yenile**; (3) config'i repo dışı `.env`/`config.local.php`'ye taşı; (4) repo özel mi kontrol et; gerekirse geçmiş temizliği (ayrı onayla).
- **Test:** Taze klonda `grep` ile gizli bilgi taraması; eski parolayla bağlantı reddi.

## B-04 — Garson eşleme (pairing) atlatılabiliyor
- **Dosya:** `api/auth.php` `case 'pair_with_code'/'pair_device'` (≈ satır 190–275); `garson/index.html` (≈ satır 638–650).
- **Kanıt:** Kod bulunamazsa ama rakam içeriyorsa **ilk aktif garson** hesabına eşleştirir ("fallback"); olmayan kullanıcıyı **otomatik oluşturur** (PIN varsayılan `'1234'` olabilir); `pairing_expires_at` bu yolda kontrol edilmiyor; istemci, sunucuya ulaşamazsa **yerel sahte garson** (`waiter-<kod>`) oluşturuyor.
- **Etki:** README'deki "5 dk, tek kullanımlık QR" garantisi fiilen yok. Yetkisiz kişi garson olarak sipariş verebilir/masa taşıyabilir.
- **Öncelik:** KRİTİK. **Çözüm:** Fallback ve oto-oluşturmayı kaldır, süre/tek kullanım zorunlu, deneme sınırı, sunucuya ulaşılamazsa eşleme başarısız say. **Test:** Yanlış kod, süresi dolmuş kod, tekrar kullanım, 100 ardışık deneme.

## B-05 — Yazdırma hatası "başarı" olarak raporlanıyor
- **Dosya:** `src/services/printerService.ts` `dispatchPrintJob` (≈ 466–545), `PosView.tsx` `handleSendToKitchen` (≈ 394–431).
- **Kanıt:** Ağ/IPC başarısız olunca `printViaHiddenFrame` çağrılır ve `printSuccess = true` atanır ("kuyruğa alındı"). Ürünler yazdırmadan **önce** `SENT_TO_KITCHEN` yapılır; başarısızlıkta bile "Mutfak fişi gönderildi" bildirimi çıkar. Kalıcı baskı kuyruğu/yeniden deneme/`printedAt` takibi yok (şemadaki `printedToKitchen` kullanılmıyor).
- **Etki:** Mutfak siparişi hiç görmez, kasa "gitti" sanır → müşteri bekler, ürün kaybı/şikayet.
- **Öncelik:** KRİTİK. **Çözüm:** Yazdırma işi kalıcı kayıt (PENDING/PRINTED/FAILED), gerçek sonuç, görünür hata, el ile yeniden bas; tarayıcı iframe fallback'i kaldır. **Test:** Yazıcı fişi çekili iken, yazıcı kapalı, kağıt bitti senaryoları (fiziksel).

## B-06 — Garson siparişi hatayı yutuyor, idempotency yok
- **Dosya:** `garson/index.html` `confirmAndSendKitchen` (≈ 1884–1918), `apiFetch` (≈ 405–440).
- **Kanıt:** `try { await apiFetch('send_order') } catch (e) {}` sonrası her durumda "✅ mutfağa iletildi ve fiş basıldı" toast'ı, sepet kapanır. `apiFetch` 4 sn zaman aşımında aynı POST'u **başka uç noktaya yeniden gönderir**; istek kimliği yok; sunucu her istekte yeni `ord-<time>-<rand>` üretir.
- **Etki:** Hem **kayıp sipariş** (hata gizlenir) hem **mükerrer sipariş** (zaman aşımı + yeniden deneme) mümkün. Toast "fiş basıldı" iddiası doğrulanmıyor.
- **Öncelik:** KRİTİK. **Çözüm:** İstemci üretimli `clientOrderId` (UUID), sunucuda UNIQUE + idempotent yanıt, durum makinesi (Gönderiliyor/Kasa aldı/Başarısız), başarısızsa sepet korunur. **Test:** Aynı isteğin 2 kez gönderilmesi, ağ kesilmesi, yanıtın kaybolması.

## B-07 — Bekleyen sipariş "okununca" tüketiliyor (en fazla bir kez)
- **Dosya:** `api/index.php` `pull_pending_orders` (≈ 1312–1350); `restaurantDataService.pullPendingOrdersFromCloud`.
- **Kanıt:** Sunucu, siparişleri döndürmeden önce `yazdirildi = 1` yapar; kasa onay (ack) göndermez. `forEach` içinde bir hata veya uygulama çökmesi olursa o sipariş bir daha gelmez. Dedup kümesi yalnızca bellekte (`processedIncomingOrderIds`), yeniden başlatmada sıfırlanır.
- **Etki:** Kasa kapanırken/yenilenirken sipariş sessizce kaybolur; yazıcıya gitmez.
- **Öncelik:** KRİTİK. **Çözüm:** Çek → kalıcı kaydet → ack; sunucuda "kilitli/teslim edildi/onaylandı" durumları; kalıcı dedup. **Test:** Kasa pull sonrası işlem öncesi öldürülür.

## B-08 — Başlangıçta bulut verisi yereli eziyor; kasa push'u buluttan siliyor
- **Dosya:** `restaurantDataService.ts` `pullAllErpDataFromCloud` (≈ 1048–1090), constructor (≈ 770–775); `index.php` `push_kasa_state` (`DELETE ... NOT IN`).
- **Kanıt:** Açılışta (100 ms) bulut `tables`, `completedOrders`, `zReports`, `customers` boş değilse yerel localStorage **değiştirilir**; ilk push 1000 ms sonra. Yerelde senkronlanmamış yeni veri varsa ezilir. Sunucu push'ta gönderilmeyen satırları siler. Ayrıca bulut masası zaten garsonun ürünlerini içerirken `pull_pending_orders` aynı siparişi tekrar getirirse kalemler **çift eklenebilir** (şüphe, bkz. S-02).
- **Etki:** Veri kaybı, ikinci kasa/yeni kurulum mevcut buluttaki veriyi silebilir.
- **Öncelik:** YÜKSEK. **Çözüm:** Tek otorite (kasa SQLite), sürüm/zaman damgalı birleştirme, silme yerine işaretleme.

## B-09 — Masa taşıma hedef masanın adisyonunu eziyor
- **Dosya:** `restaurantDataService.transferTable` (≈ 1300–1322); bulutta `index.php` `send_order` TRANSFER_TABLE dalı.
- **Kanıt:** Hedef masanın dolu olup olmadığı kontrol edilmez; `tables[tgt].order = ...` atanır. Garson uygulaması yalnızca boş masaları listeliyor ama kasa tarafı ve API doğrulamıyor.
- **Etki:** İki garson aynı anda aynı boş masaya taşırsa biri tüm adisyonunu kaybeder.
- **Öncelik:** YÜKSEK. **Çözüm:** Sunucuda işlem içinde hedef boş doğrulaması, aksi halde reddet. **Test:** Eş zamanlı taşıma.

## B-10 — Yedek yalnızca ayarları kapsıyor
- **Dosya:** `restaurantDataService.exportRestaurantBackup/importRestaurantBackup` (≈ 2753–2785); `SystemBackupTab.tsx`.
- **Kanıt:** Yedek: bölüm, kategori, ürün, garson, yazıcı, ödeme yöntemi, fiş/donanım ayarı. **Yok:** adisyon arşivi, Z raporları, müşteriler/cari hareketler, toptancı, giderler, personel hareketleri, kullanıcılar. İçe aktarma şema/sürüm doğrulaması yapmaz, mevcut veriyi üstüne yazar.
- **Etki:** "Yedekten geri yükleme" mali veriyi kurtaramaz; bozuk dosya ayarları bozabilir.
- **Öncelik:** YÜKSEK. **Çözüm:** Tam veri yedeği (SQLite dosyası + otomatik günlük rotasyon), geri yükleme öncesi otomatik yedek, doğrulama.

## B-11 — Z raporu / mali hesap hataları
- **Dosya:** `restaurantDataService.getCurrentXReport`, `closeDailyZReport` (≈ 1707–1860).
- **Kanıtlar:**
  1. Gün sınırı `new Date().toISOString().split('T')[0]` ile (UTC). Türkiye'de 00:00–03:00 arası kayıtlar önceki güne düşer; gider filtresi `e.date === todayStr`. Aynı desen ≥ 50 yerde (ReportsView, ExpenseListView, vb.).
  2. Gider/toptancı hareketleri Z'ye "işlendi" olarak bağlanmaz (siparişlerde `zReportId` var, giderlerde yok): aynı gün ikinci Z, giderleri tekrar sayar; gece yarısı geçen vardiyada eksik sayar.
  3. KDV sabit %10 (`vatRate = 10`), ürünlerin `vatRate`'i kullanılmaz; içecekler vs. farklı oran olabilir.
  4. Nakit anahtarı `paymentBreakdown['Nakit']` ad eşleşmesiyle; ödeme yöntemi adı değişirse nakit 0 görünür. "İndirim/İkram/Cari" ödeme adı içeriğiyle (`includes`) sınıflanır.
  5. `cancelLogs` Z'de silinir (`removeItem`), iptal geçmişi raporlardan düşer.
  6. `openingFloat` varsayılan 1000, `counted` verilmezse beklenen değere eşitlenir (fark 0) — API çağrısı sayım olmadan sahte mutabakat üretir (arayüz sayım istiyor, ama çekirdek fonksiyon korumasız).
- **Etki:** Yanlış ciro/KDV/kasa; vergi/ortak güveni sorunu. **Öncelik:** YÜKSEK. **Çözüm:** Yerel saat dilimi ile iş günü (kapanış saati ayarı), giderlere Z bağlantısı, ürün KDV'si, ödeme tipi enum'u. **Test:** 23:30–01:00 işlemleri, iki Z aynı gün, karma KDV.

## B-12 — Electron ve yerel sunucu güvenliği
- **Dosya:** `electron/main.ts` (`nodeIntegration:true, contextIsolation:false`), `electron/server.ts` (`cors()`, `0.0.0.0:4545`, kimlik doğrulama yok), `printerService.ts` `window.require`.
- **Etki:** Renderer'da çalışan herhangi bir XSS (ürün adı, platform siparişi, müşteri notu vb. HTML'e basılırsa) → bilgisayarda kod çalıştırma. Yerel ağdaki herkes `/api/printers/print-ticket` ile **keyfi IP:port'a** veri gönderebilir, `/api/printers/auto-scan` ile ağ taraması yaptırabilir, `/api/callerid/simulate` ile sahte çağrı.
- **Öncelik:** YÜKSEK. **Çözüm:** `contextIsolation:true` + preload + `contextBridge`; sunucu yalnızca `127.0.0.1` veya token korumalı; CORS kısıtı; hedef IP doğrulama.

## B-13 — Yerel kullanıcılar ve yetkiler
- **Dosya:** `dataService.getUsers` (≈ 1026–1040), `LoginView.tsx`, `UserManagementView.tsx` (satır ~168 parolayı listede gösterir).
- **Kanıt:** Parolalar düz metin localStorage'da, varsayılan yönetici kullanıcısı basit parola ile tohumlanıyor. Garson yetki bayrakları (`canVoidItem`, `canDiscount`, `canGift`) tanımlı ama POS/garson akışlarında **uygulanmıyor** (yalnızca `WaitersTab`/tip tanımlarında geçiyor). İptal/ikram/indirim için yetki veya PIN onayı yok.
- **Etki:** Denetimsiz iptal/ikram → kaçak ve hile. **Öncelik:** YÜKSEK. **Çözüm:** Hash'li parola/PIN, rol-izin matrisi sunucu tarafında, iptal/ikram/indirim için yönetici onayı + denetim kaydı.

## B-14 — Patron girişi
- **Dosya:** `index.php` `boss_login`, `change_boss_password`; `patron/index.html`.
- **Kanıt:** Parola düz metin saklanıp `===` ile karşılaştırılıyor; deneme sınırı yok; token doğrulanmıyor (B-02); JSON yedek modunda varsayılan parola kaynak koda gömülü ve veri dosyası (`restaurant_sync.json`) web kökünde.
- **Öncelik:** YÜKSEK. **Çözüm:** `password_hash`, oran sınırlama, imzalı oturum, `.htaccess` ile veri dosyası engeli.

## B-15 — Sunucu fiyatı/toplamı istemciden alıyor
- **Dosya:** `index.php` `send_order` (≈ 1180–1190): `if (!empty($input['totalAmount'])) $orderTotal = (float)$input['totalAmount'];` kalem fiyatları da istemciden.
- **Etki:** Kurcalanmış istemci düşük fiyatla sipariş verebilir. **Öncelik:** YÜKSEK. **Çözüm:** Fiyatı ürün tablosundan sunucuda hesapla.

## B-16 — Platform webhook imzası isteğe bağlı
- **Dosya:** `api/online/webhook.php` (≈ 70–80): imza yalnızca secret **ve** gelen imza doluysa doğrulanır; imza başlığı hiç gönderilmezse istek kabul edilir.
- **Etki:** Sahte "online sipariş" üretilebilir. **Öncelik:** YÜKSEK. **Çözüm:** Secret tanımlıysa imza zorunlu.

## B-17 — Sipariş numarası ve kimlikler çakışabilir
- `orderNumber: Math.floor(100 + Math.random() * 900)` (`updateTableOrder`, `cancelTableOrder`); `id: ord-${Date.now()}`, `arch-${Date.now()}`. Aynı milisaniye/aynı numara çakışır. **ORTA.** Çözüm: UUID + günlük artan sayaç (sunucuda).

## B-18 — Ödeme/cari kapatma atomik değil
- **Dosya:** `PosView.handleFinalizeBill` (≈ 619–650): önce `addCustomerTransaction(DEBT)`, sonra `completeTablePayment`. Arada hata/çift tetikleme olursa borç yazılır, adisyon açık kalır veya borç iki kez yazılır. Cari hareket `paymentMethod:'CASH'` ve UTC tarih ile yazılıyor. **ORTA.** Çözüm: tek işlem; "kapatılıyor" kilidi; idempotent ödeme kimliği.

## B-19 — Para birimi kayan nokta
- Toplamlar JS `number` ile (`reduce`), şemada `Float`; yuvarlama yok (PHP tarafında yer yer `round`). `decimal.js` kurulu ama kullanılmıyor. **ORTA.** Çözüm: kuruş (tamsayı) veya Decimal.

## B-20 — localStorage kotası
- Arşiv, logo/ürün resimleri (base64) aynı depoda; `QuotaExceededError` yakalanmıyor (grep sonucu boş). **ORTA.** Dolunca yazma sessizce/istisnayla başarısız → veri kaybı.

## B-21 — Garson PWA mobil/yerel ağ uygunluğu
- `garson/index.html`: viewport doğru, ancak **manifest.json ve service worker yok**, Tailwind (`cdn.tailwindcss.com`) ve Font Awesome CDN'den yükleniyor → internet yokken arayüz bozulur; HTTP üzerinden (yerel IP) tarayıcı kamerasına izin vermez (QR tarama güvenli bağlam ister). **ORTA/YÜKSEK** (yerel ağ hedefi için). Ayrıntı: 07 numaralı belge.

## B-22 — Geliştiricinin alan adlarına düşen yedek adresler
- `garson/index.html` `API_ENDPOINTS` listesi `api.rymedya.com.tr`, `garson.rymedya.com.tr`, `rymedya.com.tr` adreslerini sabit içerir; işletme adresi yanıt vermezse veriler **başka bir sunucuya** gidebilir. Kasa tarafında aynı sorun commit `c09365e`/`f4421e7`'de temizlenmiş ama garson sayfasında duruyor. **ORTA (gizlilik).** `README`/`.env.example` de aynı alan adını gösteriyor.

## B-23 — Çoklu/uyumsuz şema kaynakları
- Prisma şeması, 3 SQL dosyası ve PHP içi `CREATE TABLE`; alan adları farklı (örn. Prisma `Employee` vs MySQL `personeller`). Kimin doğru olduğu belirsiz. **ORTA.**

## B-24 — Düşük öncelikli
- `/api/health` Express'te yok ama `SystemBackupTab` bunu çağırıyor → servis çalışsa bile "OFFLINE".
- `prisma/dev.db-journal` Git'te izleniyor (içeriği incelenmedi; gerçek veri parçası içerebilir).
- `prompt.txt`, `.github/prompts/`, `opencode.json` depo dışı olması gereken araç dosyaları.
- Test yok, CI yok, lint yalnızca `tsc`.
- Türkçe karakterler fişte ASCII'ye çevriliyor (`formatTurkishText`), CP857 seçili olduğu halde kullanılmıyor — okunabilirlik/ürün adı kalitesi.
- Dev ve prod origin farkı (`http://localhost:3000` vs `file://`) ayrı localStorage demek: geliştirme verisi üretimle karışmaz ama göç planında dikkat.

---

## Doğrulanması gereken şüpheler (kesin hata sayılmamalı)
- **S-01** Çift tıklamayla `handleFinalizeBill` cari borcu iki kez yazabilir (React state kilidi yok; ikinci çağrıda `completeTablePayment` masa boş görüp döner ama borç satırı önce yazılır).
- **S-02** Kasa açılışında `get_all_erp_data` garson kalemlerini zaten içeren masayı getirir, ardından `pull_pending_orders` aynı siparişi getirirse kalemler ve mutfak fişi çift olabilir.
- **S-03** `send_order` içindeki okuma-değiştirme-yazma (masa JSON birleştirme) işlem/kilit olmadan; iki garson aynı anda gönderirse biri kaybolabilir (`merge_tables` `FOR UPDATE` kullanıyor, `send_order` kullanmıyor görünüyor).
- **S-04** NSIS kaldırma/yeniden kurulumda `%APPDATA%` altındaki localStorage'ın silinip silinmediği.
- **S-05** `WaiterView.tsx` (uygulama içi garson modu) ayrıntılı incelenmedi.
- **S-06** Webhook JSON modunda `restaurant_sync.json` gerçekten web'den okunabilir mi (sunucu yapılandırmasına bağlı).
- **S-07** Afanda 892E'de RAW spooler yolunun (`sendToWindowsSpooler`) gerçekten çalıştığı.
