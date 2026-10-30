> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

# 01 — Mevcut Durum (Teknik Denetim, Aşama 1)

Denetim tarihi: 2026-10-30. Yöntem: yalnızca statik kod okuma. Hiçbir şey çalıştırılmadı, kurulmadı, değiştirilmedi.

## 1. Repo / Git durumu

| Madde | Değer |
|---|---|
| Yerel klasör | `C:\Users\AdlineMedya\Desktop\taha_usta_erp` (repo dosyaları doğrudan kökte) |
| Remote (fetch/push) | `https://github.com/BrandCoor/gaziantepli-taha-usta-erp.git` |
| Varsayılan / mevcut dal | `main` (origin/main ile aynı, çalışma ağacı temiz) |
| Son commit | `285c2ec` — "Platform API bağlantı testindeki çökmeyi düzelt ve test siparişi butonunu kaldır" (2026-09-17) |
| Uzak dallar | `claude/admiring-hopper-2ly69w`, `claude/affectionate-ptolemy-7zjxnl`, `revert-2-claude/affectionate-ptolemy-7zjxnl` |
| Dosya sayısı / boyut | 100 izlenen dosya, ~40 bin satır TS/TSX/PHP/HTML |
| `node_modules` | Yok (bağımlılıklar kurulu değil → derleme/tip/lint çalıştırılamadı) |
| Test | Hiç otomatik test dosyası yok; lint betiği yalnızca `tsc --noEmit` |

## 2. Gerçek mimari (koddan)

```
 Android/iPhone tarayıcı ─► cpanel-yuklenecekler/garson/index.html  (bulut hosting, vanilla JS)
                                   │  fetch (HTTPS, ?action=...)
                                   ▼
                       cpanel-yuklenecekler/api/index.php  (PHP + MySQL, JSON dosya yedek modu)
                                   ▲  1.5 sn de bir polling + her değişiklikte push
                                   │
 Kasa: Electron (React/Vite) ── renderer: localStorage = ASIL VERİ DEPOSU
        │  main.ts: IPC (yazıcı)       
        └─ server.ts: Express+WS :4545  → sadece yazıcı + CallerID uçları
              ├─ ESC/POS → TCP 9100 (Ethernet) / Windows spooler (USB)
              └─ GCallerID seri/HTTP
```

Kritik tespitler:
- **Prisma/SQLite kullanılmıyor.** `prisma/schema.prisma` mevcut ama `src/` ve `electron/` içinde hiç `PrismaClient` yok. Gerçek veri **Electron renderer `localStorage`** içinde (`restaurantDataService.ts` `STORAGE_KEYS`, `dataService.ts`).
- **MySQL** yalnızca uzaktaki "ayna" ve garson köprüsü; kasa her değişiklikte tüm durumu `push_kasa_state` ile gönderir (`restaurantDataService.pushStateToCloud`).
- **Yerel Express (:4545)** yalnızca yazıcı ve CallerID için; sipariş/masa/kimlik doğrulama uçları yok, statik dosya servis etmiyor, WebSocket yalnızca CallerID olayını yayınlıyor (`electron/server.ts`).
- **Garson uygulaması yerelde değil bulutta** (`garson/index.html`); kasa kapalı olsa bile bulut çalışır ama kasa internetsiz ise garson–kasa bağlantısı kopar.
- Şema kaynakları dört ayrı yerde: `prisma/schema.prisma` (kullanılmıyor), `database.sql`, `veritabani_kurulum.sql`, `config.php::ensureDatabaseTables` (+ `database_migration.sql`).

## 3. Teknoloji listesi ve amaçları

| Teknoloji | Kullanım |
|---|---|
| Electron 33 | Kasa masaüstü kabuğu; `nodeIntegration:true`, `contextIsolation:false` |
| React 18 + TS + Vite 6 + Tailwind | Kasa arayüzü |
| Zustand | bağımlılıkta var; kullanımı doğrulanmadı |
| Express 5 + ws | Yerel yazıcı/CallerID servisi |
| Prisma + SQLite | **Tanımlı ama bağlı değil** |
| decimal.js | Yalnızca `formatters.ts`; iş mantığında para hesabı JS `number` ile |
| exceljs, jspdf | Rapor dışa aktarma |
| PHP + MySQL (cPanel) | Senkronizasyon API'si, garson/patron/menü sayfaları |
| BroadcastChannel/localStorage events | Aynı tarayıcı sekmeleri arası eşitleme (`realtimeSyncService.ts`) |

## 4. Modül envanteri (özet; ayrıntı 03 numaralı belgede)

POS (`PosView.tsx` 2382 satır), Raporlar/Z (`ReportsView.tsx`, `ZCloseModal.tsx`), Yazıcı (`printerService.ts`, `electron/printer.ts`), Müşteri/Cari, Giderler/Toptancı, Personel (maaş/mesai), Paket servis + CallerID, Online platformlar, Ayarlar (bölüm/masa/ürün/yazıcı/garson/yedek), Garson PWA, Patron paneli, QR menü (`menu/index.html`).

## 5. Veri akışı (kritik yol: sipariş)

1. Kasa: `PosView.handleAddProduct` → yerel `orderItems` (state) → `handleSendToKitchen` → `restaurantDataService.updateTableOrder` (localStorage'a yazar, `notify()` → `pushStateToCloud` debounce 200 ms) → `printerService.printKitchenTickets`.
2. Garson: `confirmAndSendKitchen` → `POST ?action=send_order` → PHP `masalar.aktif_siparis`'e birleştirir + `siparisler` tablosuna bekleyen kayıt ekler.
3. Kasa her 1.5 sn `pull_pending_orders` çeker → `processIncomingOrder` → masaya birleştirir → mutfak yazıcısı callback'i.
4. Kasa ödeme: `handleFinalizeBill` → cari borç yazar → `completeTablePayment` → `COMPLETED_ORDERS` (localStorage) → bulut push.

## 6. Koddan anlaşılan ve fiziksel/gerçek ortam testi gerektiren ayrımı

**Koddan okunabilen (çalıştığı doğrulanmış sayılmaz):** masa/adisyon akışı, parçalı ödeme, cari borç, Z raporu hesabı, yazıcı yönlendirme sırası, PHP uç noktaları, eşleme mantığı.

**Fiziksel/gerçek ortam gerektirir:** Afanda 892E ESC/POS çıktısı ve CP857 Türkçe karakter, USB spooler RAW yazımı, Ethernet 9100 yazıcılar, GCallerID cihazı, iPhone/Android tarayıcı davranışı, kamera ile QR okuma, cPanel/MySQL gerçek çalışması, Windows Güvenlik Duvarı, NSIS kurulum/güncelleme ve veri korunumu, çoklu garson eşzamanlılığı.

## 7. Çalıştırılabilen kontroller

Yalnızca Git komutları ve statik arama. `npm run lint/build` çalıştırılamadı (bağımlılık yok; kurulum bu aşamada yasak). Test altyapısı zaten yok.

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

# 03 — Modül ve Özellik Envanteri

Sınıflar: **K** = Mevcut ve korunabilir · **H** = Mevcut ancak hatalı/eksik · **Y** = Yeniden tasarlanması öneriliyor · **E** = Eksik; ileride geliştirilebilir · **D** = Doğrulanamadı.
Hiçbir modül çalıştırılarak test edilmedi; sınıflama koda dayanır.

| Modül | Dosya | Sınıf | Gerekçe |
|---|---|---|---|
| Veri deposu (localStorage) | `restaurantDataService.ts`, `dataService.ts` | **Y** | B-01, B-10, B-20. İş mantığı (hesaplama, akışlar) taşınabilir; depolama katmanı değişmeli |
| Prisma şeması | `prisma/schema.prisma` | **H** | Bağlı değil. İyi bir başlangıç taslağı (Order/OrderItem/Payment/…); float para, Z/audit/idempotency alanları eksik. Yeni şemaya temel olabilir |
| POS arayüzü (masa/ürün/adisyon) | `PosView.tsx` | **H** | UI akışı zengin (parçalı ödeme, iptal sebepleri); 2382 satır tek dosya, yetki kontrolü yok, ödeme atomik değil |
| Parçalı ödeme / Alman usulü | `PosView.tsx` | **K** (mantık) / **H** | Kalan tutar kontrolü var; indirim gerçek indirim değil (yalnızca tutar kısayolu) |
| Gerçek indirim, iade | — | **E** | Ödeme türlerinde "İndirim" adı geçiyor; iade akışı yok |
| Masa birleştirme / bölme | PHP `merge_tables` var; kasa UI yok | **H/E** | Sunucuda işlemli birleştirme iyi; kasa arayüzünde kullanımı doğrulanmadı |
| Masa taşıma | `transferTable` | **H** | B-09 |
| İptal / ikram | `cancelItemQuantity`, `cancelTableOrder` | **H** | Log tutuluyor, yetki/PIN yok, Z'de siliniyor |
| Mutfak yazdırma yönlendirme | `printerService.printKitchenTickets` | **K** (yönlendirme) / **H** | Ürün→kategori→istasyon→yedek yazıcı sırası makul; hata gizleme B-05 |
| ESC/POS üretimi | `electron/printer.ts` | **K** | Temel komutlar (kesme, çekmece, kod sayfası) doğru görünüyor; Türkçe ASCII'ye dönüşüyor; fiziksel test şart |
| USB/Spooler | `sendToWindowsSpooler` | **D** | Fiziksel doğrulama gerekir |
| Ethernet 9100 | `sendToNetworkPrinter` | **K/D** | Basit ve doğru; teslim onayı yok |
| Yerel Express/WS sunucu | `electron/server.ts` | **H** | Auth yok, keyfi IP; mobil için doğru yerde ama içi boş (B-12) |
| CallerID | `callerid/gcallerid.ts`, `callerIdService.ts` | **D** | Donanım gerekli |
| Paket servis | `DeliveryView.tsx` | **D/K** | Mantık okundu, çalıştırılmadı |
| Müşteri / cari | `CustomerListView.tsx`, `dataService` | **K** (mantık) | Bakiye silme kilidi iyi; hareket düzenleme bakiyeyi yeniden hesaplıyor; veri deposu sorunu |
| Giderler / toptancı | `ExpenseListView.tsx` | **K** (mantık) / **H** | Z'ye bağlanmıyor (B-11) |
| Personel (maaş, mesai, avans) | `employees/*`, `dataService` | **K** (mantık) / **H** | Bakiye hareketlerden hesaplanıyor (iyi); IBAN düz veri; yetki yok |
| Raporlar / X-Z | `ReportsView.tsx`, `ZCloseModal.tsx`, `getCurrentXReport` | **H** | B-11; sayım ekranı var |
| Kullanıcı / roller | `LoginView.tsx`, `UserManagementView.tsx` | **Y** | B-13 |
| Ayarlar (bölüm/masa/ürün/yazıcı) | `restaurant-settings/*` | **K** | Büyük ölçüde konfigürasyon CRUD |
| Yedekleme | `SystemBackupTab.tsx` | **Y** | B-10 |
| Garson PWA (bulut) | `cpanel-yuklenecekler/garson/index.html` | **H** | UI mobil uyumlu; hata yutma, idempotency yok, PWA özelliği yok (07) |
| Uygulama içi garson modu | `src/modules/waiter/*` | **D** | İncelenmedi (S-05) |
| Eşleme / cihaz kimliği | `api/auth.php` | **Y** | B-04 |
| Bulut API | `api/index.php` (2520 sat.) | **Y** | Tek dosya, auth yok, B-02/07/15 |
| Patron paneli | `patron/index.html` | **H** | Okuma paneli konsepti iyi; B-14 |
| QR menü | `menu/index.html` | **D/E** | Yalnızca görüntü; çevrim içi sipariş yok |
| Online platform entegrasyonu | `onlinePlatformService.ts`, `api/online/*` | **H/D** | Gerçek platform çağrısı doğrulanmadı; imza zorunlu değil (B-16); gizli bilgi (B-03) |
| Mutfak ekranı (KDS) | — | **E** | Yok; yazıcı kuyruğu kalıcı hale gelince eklenebilir |
| Stok / reçete maliyeti | `Product.costPrice` alanı | **E** | Stok hareketi yok |
| Çoklu şube / kiracı | — | **E** | Yok |
| Otomatik test, CI | — | **E** | Yok |
| Kurulum / güncelleme | `kurulum_ve_setup.bat`, electron-builder (NSIS) | **H/D** | Müşteri kurulumu `npm install`+build gerektiriyor; otomatik güncelleme yok; veri taşıma planı yok |

# 04 — Geliştirme Yol Haritası

İlke: Önce veri kaybı ve para güvenliği, sonra mobil/senkron, sonra özellik. Tüm yeniden yazma önerileri "kademeli": çalışan UI mantığı korunur, altındaki depolama ve API değişir. Her aşama onayınızla başlar. Hiçbir aşama mevcut veriyi yedeksiz değiştirmez.

## Aşama 0 — Acil güvenlik ve yedek (kod değişikliği minimal, öncelik KRİTİK)
- **Amaç:** Açık kapıları kapatmak, mevcut işletme verisini güvene almak.
- **İşler:** (1) cPanel DB parolası ve platform API anahtarlarını **döndür** (kod dışı, sizin yapacağınız işlem); (2) kasadaki mevcut localStorage verisini (Electron profil klasörü `%APPDATA%\gaziantepli-taha-usta`) **yalnızca kopyalayarak** yedekle; (3) PHP API'yi geçici olarak IP/`.htaccess` ile kısıtla veya devre dışı bırak; (4) `config.php`'yi repo dışına al.
- **Bağımlılık:** Yok. **Etkilenen:** `api/config.php`, hosting ayarları. **Veri kaybı riski:** Düşük (kopyalama). 
- **Kabul:** Eski DB parolası çalışmıyor; yedek kopyası başka diske alınmış ve açılabiliyor.
- **Test:** Taze klonda gizli bilgi taraması; hosting'te auth'suz çağrı reddi.

## Aşama 1 — Güvenilir merkez: kasa SQLite + yerel API (temel)
- **Amaç:** Tek doğruluk kaynağı. Kasa Electron "main" sürecinde SQLite (Prisma ya da better-sqlite3 — gerekçe: Prisma şeması hazır; dosya tek, yedeklemesi kolay, internet gerektirmez).
- **İşler:** Şemayı gözden geçir (kuruş tamsayı, `clientOrderId` UNIQUE, olay/denetim tablosu, baskı işi tablosu); veriyi `%ProgramData%\RYMedya\GaziantepliTahaUsta\` altına koy (kurulum klasöründen bağımsız); **localStorage → SQLite tek yönlü, doğrulamalı göç aracı** (eski veri silinmez); `restaurantDataService` işlemlerini API üzerinden çağıran ince katmana dönüştür.
- **Bağımlılık:** Aşama 0. **Etkilenen:** `restaurantDataService.ts`, `dataService.ts`, `prisma/`, `electron/main.ts`. **Veri kaybı riski:** YÜKSEK (göç) → göç öncesi tam yedek, kuru çalıştırma, kayıt sayısı/bakiye eşleştirme raporu, geri dönüş yolu.
- **Kabul:** Göçten sonra tüm müşteri/cari bakiyeleri, adisyon ve Z toplamları eski veriyle birebir aynı; çökme testi sonrası kayıp yok.
- **Test:** Göç doğrulama betiği, kapanma/güç kesintisi, 10 bin kayıt performansı.

## Aşama 2 — Sipariş çekirdeği (idempotent, işlemli)
- **İşler:** Sunucu tarafı sipariş servisi: `clientOrderId` ile idempotent ekleme, masa sürümü (optimistic concurrency), taşıma/birleştirme işlemli, fiyatı sunucuda hesaplama, sipariş durum makinesi; kalıcı sıralı sipariş numarası; ödeme tek işlemde (cari dahil).
- **Bağımlılık:** Aşama 1. **Kabul:** Aynı istek 2 kez gelince 1 kayıt; iki cihaz aynı anda aynı masaya ekleyince iki ürün de görünür; taşıma dolu masaya reddedilir.
- **Test:** Eş zamanlılık ve tekrar deneme otomatik testleri (ilk test paketi burada kurulur).

## Aşama 3 — Mutfak/yazıcı kuyruğu
- **İşler:** Kalıcı baskı işi (PENDING/PRINTED/FAILED), gerçek sonuç, yeniden deneme + el ile yeniden bas, "yazdırıldı" gerçek bilgi, tarayıcı fallback'i kaldır, kasada görünür uyarı. Afanda 892E: önce fiziksel doğrulama.
- **Bağımlılık:** Aşama 2. **Kabul:** Yazıcı kapalıyken sipariş kaybolmaz, "başarısız" görünür; açılınca tek çıktı. **Test:** Fiziksel yazıcı senaryoları (05 belgesi).

## Aşama 4 — Mobil garson (yerel ağ PWA) — bkz. 07
- **İşler:** Garson PWA'yı kasa sunucusundan servis et; manifest + service worker + yerel varlıklar (CDN'siz); kimlik doğrulama (cihaz eşleme + PIN, oturum token); WebSocket ile canlı masa; sipariş durum göstergesi; HTTPS (yerel sertifika) ya da kamera gerektirmeyen eşleme kodu.
- **Bağımlılık:** Aşama 2 (3 önerilir). **Kabul:** 3 telefon aynı anda; internet kablosu çekilince sipariş akışı sürer.

## Aşama 5 — Yetki, denetim, Electron sertleştirme
- Hash'li parola/PIN, rol-izin uygulaması, iptal/ikram/indirim için onay, denetim günlüğü, `contextIsolation`+preload, sunucuyu yetkili cihazla sınırlama. **Kabul:** Yetkisiz iptal denemesi reddedilir ve loglanır.

## Aşama 6 — Mali doğruluk
- İş günü/saat dilimi, giderlerin Z'ye bağlanması, ürün bazlı KDV, kuruş aritmetiği, gerçek indirim/iade, Z değişmezliği. **Test:** Gece yarısı, çift Z, karma KDV senaryoları.

## Aşama 7 — Yedek/geri yükleme ve güncelleme
- Otomatik günlük SQLite yedeği (rotasyon, ikinci diske), geri yükleme sihirbazı, sürüm göçü (migration) ve geri dönüş; NSIS kurulumunda veriyi silmeme; otomatik güncelleme (imzalı).

## Aşama 8 — Uzak katman (gerekirse)
- Bulut PHP API'yi yalnızca **kasa→bulut tek yönlü senkron + patron paneli + QR menü** için yeniden yaz (auth'lu). Garson akışı artık buluta bağımlı değil.

## Aşama 9 — Yeni özellikler
KDS, QR menü/online sipariş, stok/maliyet, çoklu şube, gerekirse yerel mobil uygulama (API zaten hazır olacağı için ek maliyet düşük).

**İlk önerilen adım:** Aşama 0 + Aşama 1 için ayrıntılı göç tasarımı. Kod yazmaya onayınızdan önce göç planı ayrıca sunulacaktır.

# 05 — Test ve Kabul Planı (yalnızca plan)

Kural: Üretim/gerçek işletme verisinde test yapılmaz. Testler ayrı bir test kurulumunda (ayrı veri klasörü/veritabanı), kapalı saatte ve yedek alındıktan sonra yapılır. "Fiziksel" etiketli maddeler gerçek cihaz gerektirir.

| # | Senaryo | Adımlar | Beklenen | Tür |
|---|---|---|---|---|
| 1 | Masa açma + sipariş ekleme | Kasa'dan masa seç, 3 ürün ekle | Adisyon kalıcı kayıtlı; uygulama yeniden başlayınca aynı | Otomatik+manuel |
| 2 | Mutfağa gönderme | Gönder | Doğru istasyon yazıcısı, yalnızca yeni kalemler, "gönderildi" ancak yazıcı sonucu başarılıysa | Fiziksel |
| 3 | İlave sipariş (delta) | Aynı masaya ürün ekle | Sadece yeni kalem basılır, eskiler tekrar basılmaz | Fiziksel |
| 4 | Miktar değiştirme | Gönderilmiş ürünü azalt | İptal sebebi + yetki; mutfak iptal fişi; log | Manuel |
| 5 | Ürün/adisyon iptali | İptal et | Arşivde CANCELLED, rapor ve Z'de iptal toplamı korunur | Manuel |
| 6 | Çok garson | 3 telefon aynı anda farklı/aynı masaya ekler | Hiçbir kalem kaybolmaz/çiftlenmez, tüm cihazlar güncel görür | Fiziksel |
| 7 | Dolu masaya taşıma | İki cihaz aynı boş masaya taşır | İkincisi reddedilir, veri kaybı yok | Otomatik |
| 8 | A: internet kesik, yerel ağ açık | WAN kablosu çek, sipariş ver | Sipariş kasaya ulaşır, yazıcıdan çıkar | Fiziksel |
| 9 | B: kasa kapalı/ağ kopuk | Telefondan gönder | Telefon "GÖNDERİLEMEDİ" gösterir, sepet korunur, "gönderildi" denmez | Fiziksel |
| 10 | Yinelenen istek | Aynı `clientOrderId` 2 kez | Tek kayıt, tek çıktı | Otomatik |
| 11 | Yanıt kaybı | Sunucu işler, yanıt telefona ulaşmaz, telefon yeniden dener | Çift sipariş yok | Otomatik |
| 12 | Kasa süreç çökmesi | Siparişi aldıktan sonra süreci öldür | Yeniden açılışta sipariş ve baskı işi duruyor, kaybolmamış | Otomatik |
| 13 | Ödeme | Nakit+kart+cari karma | Toplam eşit, masa boşalır, cari bakiye doğru, tek kez | Manuel |
| 14 | Çift tıklama kapat | Hızlı iki tık | Tek ödeme/tek cari borç | Otomatik |
| 15 | Gün sonu | Çok ödeme türü, gider, toptancı ödemesi | X/Z toplamları elle hesapla eşit; 00:00–03:00 işlemleri doğru günde | Manuel |
| 16 | İkinci Z aynı gün | Z, sonra yeni satış, Z | Giderler çift sayılmaz | Otomatik |
| 17 | Yazıcı kesintisi | Kablo çek / kağıt bit | Kasada görünür hata; açılınca bir kez baskı veya el ile yeniden | Fiziksel |
| 18 | Afanda 892E | Türkçe karakter, kesme, çekmece, 80 mm genişlik | Okunaklı, 48 sütun, doğru kesim | Fiziksel |
| 19 | Güncelleme | Yeni sürüm kur | Veri klasörü aynı, kayıt sayıları ve bakiyeler eşit | Manuel |
| 20 | Yedekten geri yükleme | Yedek al, veri boz, geri yükle | Tüm adisyon/cari/Z geri gelir (yalnızca ayar değil) | Manuel |
| 21 | Yetkisiz erişim | Kimlik doğrulamasız API çağrısı, eşleşmemiş cihaz | 401/403 | Otomatik |
| 22 | Pairing | Yanlış/süresi dolmuş/yeniden kullanılmış kod | Hepsi reddedilir | Otomatik |
| 23 | Yük | 15 masa, 30 ürün/dk, 5 cihaz | Gecikme < 1 sn, hata yok | Fiziksel |
| 24 | iPhone Safari / Android Chrome | Ana ekrana ekle, ekran kilidi aç-kapa | Oturum/yeniden bağlanma davranışı belgelenir | Fiziksel |
| 25 | Kasa yeniden başlatma | Windows yeniden başlat | Sunucu otomatik başlar, telefonlar yeniden bağlanır | Fiziksel |

## Kabul ölçütleri
- 1–25'in tamamı geçer; kritik senaryolarda (6, 9–12, 14, 17, 19, 20) sıfır veri kaybı/çift kayıt.
- Her aşama sonunda ilgili senaryolar tekrarlanır (regresyon). Otomatik testler CI'da koşar.

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

# 07 — Mobil Mimari ve Senkronizasyon

Kapsam: yalnızca inceleme. Mimari kesinleştirilmemiştir; öneriler "aday"dır ve kod incelemesine dayanır. Telefonlarda hiçbir test yapılmadı.

## 1. Mevcut garson uygulamasının teknik durumu
- **Ne:** `cpanel-yuklenecekler/garson/index.html` — tek dosya (2020 satır), vanilla JS + Tailwind CDN, React/TS altyapısından **bağımsız**. Ayrıca kasa içinde `src/modules/waiter/*` (WaiterView/Pairing/Login; incelenmedi).
- **Nerede çalışıyor:** cPanel hosting (bulut). Yerel Express (`electron/server.ts`) bu sayfayı **servis etmiyor**; sipariş/masa/kimlik uçları da yok.
- **Veri:** Telefon → `api/index.php?action=send_order` → MySQL `masalar.aktif_siparis` ve `siparisler` (bekleyen). Kasa 1.5 sn'de bir çeker. Masa görünümü için telefon 4 sn'de bir `get_live_state` ile polling yapar (`setInterval`, satır ~1362). Yani WebSocket **yok**; "gerçek zamanlı" iddiası polling'dir. `BroadcastChannel` yalnızca aynı tarayıcıdaki sekmeleri eşitler (telefon–kasa arasında işe yaramaz).
- **Sorunlar:** hata yutma ve yalancı başarı bildirimi (B-06), idempotency yok, istemci fiyatına güven (B-15), eşleme atlatma (B-04), auth yok (B-02), geliştirici alan adlarına yedek (B-22).
- **Sonuç:** UI konsepti (masa, hızlı notlar, hesap iste, masa taşıma, QR/PIN) korunabilir; veri/kimlik/ağ katmanı yeniden kurulmalıdır. Sayfa yeniden yazılması şart değil — önce API sözleşmesi değişir.

## 2. Android ve iPhone uyumluluğu
- Olumlu: `viewport` doğru, mobil düzen, dokunmatik düğmeler (kodda görünüyor).
- Doğrulanamadı: gerçek Safari/Chrome davranışı, ekran kilidi sonrası oturum, ses (`playBeep` iOS'ta kullanıcı etkileşimi ister), klavye ve büyük ekran/küçük ekran düzenleri.
- Kısıt: `maximum-scale=1, user-scalable=no` erişilebilirlik açısından önerilmez ama POS için kabul edilebilir.
- Kamera ile QR okuma (`zxing`) **güvenli bağlam (HTTPS veya localhost)** ister; `http://192.168.x.x` üzerinden iOS/Android tarayıcı kamerayı vermez. Yerel ağ için ya yerel HTTPS sertifikası ya da kod/PIN ile eşleme gerekir.

## 3. PWA olarak geliştirilme uygunluğu
Mevcut durum: `manifest.json` yok, service worker yok, `apple-touch-icon`/tema rengi yok, Tailwind ve Font Awesome internetten (CDN) yükleniyor → **PWA değil, normal web sayfası**; internet yokken arayüz stilsiz/ikonsuz açılır.
Değerlendirme: PWA **uygun** — garson ihtiyaçları (liste, sepet, gönderim) tarayıcı yeteneklerinin içinde; mağaza gerekmez. Gerekenler: manifest + ikonlar, yerel (derlenmiş) CSS/ikon, service worker ile uygulama kabuğu önbelleği, durum göstergesi.
Sınırlar (varsayılmamalı): iOS'ta arka planda çalışma/push/periyodik senkron güvenilir değil; ekran kapanınca WebSocket kopar → açıldığında yeniden bağlanıp tam durum çekmeli; iOS PWA depolaması temizlenebilir (kodda `persistentSet` bunu önlemeye çalışıyor); çevrimdışı "kuyrukta bekleyen sipariş" tehlikelidir (garson gönderdi sanabilir) → ilk sürümde **çevrimdışı kuyruk yok, yalnızca açık hata** öneriliyor.
Tavsiye: PWA devam; ayrı React uygulaması gerekirse ortak tipler/API istemcisi paylaşılsın, şimdilik tek dosya sayfayı derlenmiş modüle bölmek yeterli.

## 4. Kasa bilgisayarının yerel sunucu olarak kullanılabilirliği
Mevcut: Electron açıldığında `startLocalServer(4545)` 0.0.0.0'a bağlanıyor; Express + `ws` mevcut. **Uygun altyapı var, içerik yok.**
Eksikler:
- Sunucu **Electron penceresine bağlı**; kullanıcı uygulamayı kapatırsa (`window-all-closed → quit`) garsonlar düşer. Yeniden başlatmada otomatik açılma (Windows başlangıç / hizmet) tanımlı değil (`baslat_pos_kiosk.bat` var, otomatik başlatma doğrulanmadı).
- Veri renderer'da (localStorage) → sunucu süreci veriye erişemez. Önce veri main sürece (SQLite) taşınmalı (Yol haritası Aşama 1).
- Kimlik doğrulama, oturum, CORS kısıtı yok; kayıtlı cihaz modeli yok.
- IP adresi: DHCP ile değişebilir → kasaya rezerve/statik IP ve yerel ad (örn. mDNS `kasa.local`) gerekir; QR/URL buna göre üretilmeli.
- Windows Güvenlik Duvarı: 4545 (veya seçilecek port) için **yalnızca "Özel ağ" profilinde** gelen kurala izin (kurulum adımı). Güvenlik duvarını kapatmak önerilmez. Port yönlendirme yapılmaz, internete açılmaz.
- Çoklu telefon: Express/ws bunu kaldırır (10–20 cihaz küçük yük); darboğaz veri katmanıdır.

## 5. Yerel ağ bağlantısı ve güvenlik gereksinimleri
- Garson sayfası ve API aynı kaynaktan (kasa) servis edilirse CORS ve karma içerik sorunları ortadan kalkar.
- HTTPS: yerel ağda genel sertifika alınamaz; seçenekler (a) kasa için yerel CA/ kendi imzalı sertifika (telefona güven kurulumu gerekir), (b) HTTP + kamera yok (PIN/kod ile eşleme), (c) iç alan adı. İlk sürüm için (b) en basit, risk: aynı Wi-Fi'deki dinleyici trafiği okuyabilir → misafir Wi-Fi'den ayrı **personel ağı**, WPA2/3.
- Cihaz kaydı: bir kez kasada onaylanan cihaz kimliği (rastgele gizli anahtar, telefonda saklı), iptal edilebilir; sonra PIN. Tüm API çağrıları token ile; yetki sunucuda.
- Hız sınırlama (PIN denemeleri), tüm işlemler denetim günlüğüne.

## 6. Veritabanı ve senkronizasyon sorunları (kod kanıtlı)
| Sorun | Kanıt | Sonuç |
|---|---|---|
| Üç veri kopyası: kasa localStorage, bulut MySQL, telefon localStorage (`gtu_*` anahtarları) | `restaurantDataService`, `garson/index.html` ~1289 | Tutarsızlık, "kim doğru?" belirsiz |
| Son yazan kazanır | `push_kasa_state` tüm tabloyu `ON DUPLICATE KEY UPDATE` + `DELETE NOT IN` | Eşzamanlı güncelleme kaybı |
| Okuma-değiştirme-yazma kilitsiz | `send_order` (merge_tables kilitli) | İki garson aynı anda → kayıp kalem (S-03) |
| At-most-once teslim | `pull_pending_orders` ack yok | Kayıp sipariş (B-07) |
| Yalancı başarı | `confirmAndSendKitchen` | Garson gönderdi sanır |
| İdempotency yok | sunucu id üretir, istemci tekrar dener | Çift sipariş |
| Fiyat istemciden | `send_order` | Kurcalama |
| Kasa kapalıyken telefon bulut üzerinden "başarılı" görür | sipariş kuyruğa yazılır ama kasa yok | Mutfağa ulaşmaz; telefon durumu bilmez |
| Polling 4 sn / 1.5 sn | Kod | Gecikme, bağlantı yükü |

Hedef senkron modeli (aday): kasa SQLite = tek doğruluk kaynağı; telefon **ince istemci** (kalıcı durum yok); komutlar `clientOrderId` ile gönderilir; sunucu işler ve `{status: RECEIVED|DUPLICATE|REJECTED, serverOrderId, tableVersion}` döner; masa değişiklikleri WebSocket ile yayınlanır (olay numarası/sürüm ile; kopukluktan sonra "son bildiğim sürümden bu yana" veya tam durum çek); çakışmada masa sürümü uyuşmuyorsa istemciye güncel adisyon gösterilip yeniden onay.

## 7. İnternet kesintisinde çalışma planı
- **A (internet yok, kasa+Wi-Fi var):** Telefon↔kasa tamamen yerel ağda → sipariş, yazdırma, ödeme çalışır. Bugünkü mimaride **çalışmaz**: garson API'si bulutta ve bulut adresi sabit (api/garson sayfası internetten). Yerel sunucudan servis edilince çalışır. Bulut senkronu (patron paneli, QR menü) kasa tarafında arka planda kuyruğa alınır, internet gelince gönderilir (tek yönlü, idempotent).
- **B (kasa kapalı/ağ kopuk):** Telefon sunucuya erişemiyorsa gönderim yapılamaz; ekran "KASA'YA ULAŞILAMIYOR — sipariş gönderilmedi" gösterir, sepet saklanır, otomatik yeniden bağlanır, kullanıcı elle gönderir. Çevrimdışı kuyruğa alıp "gönderildi" demek yok.
- Bağlantı durumu şeridi (Bağlı / Yeniden bağlanıyor / Çevrimdışı) ve her siparişte durum rozeti: Gönderiliyor → Kasa aldı → Mutfağa gitti → Yazıldı / Başarısız.

## 8. Mutfak ve yazıcı bağlantısı
Zincir bugün: telefon → bulut → kasa poll → `processIncomingOrder` → `kitchenPrintCallback` → `printerService.printKitchenTickets` → `dispatchPrintJob`. Hata bildirimi ve kalıcılık yok (B-05, B-07). Çift fiş riski: (a) kasa yeniden başlayınca bellek içi dedup kaybolur; (b) S-02.
Afanda 892E: ESC/POS üretimi ve 9100/spooler yolu mevcut kod tabanında **korunabilir**; fiziksel doğrulama gerekir. Hedef: sipariş sunucuda kaydedilince aynı işlemde `print_jobs` satırı oluşur; kasa süreci kuyruğu işler, sonuç yazar, başarısızsa yeniden dener/uyarır; KDS aynı kuyruğu/siparişi okuyan ikinci bir tüketici olur (mimari buna uygun hale gelir).

## 9. Önerilen mimari ve alternatifler
**Önerilen (aday):** Yerel merkez = kasa. Electron main süreci içinde: SQLite + sipariş servisi + Express (HTTP API) + WebSocket + PWA statik servisi + yazdırma kuyruğu. React kasa arayüzü ve garson PWA aynı API'yi kullanır. Bulut yalnızca tek yönlü yedek/patron/QR menü için (sonraki aşama). Windows başlangıçta otomatik, güvenlik duvarı özel ağa kural.
Alternatifler:
1. *Mevcut bulut merkezli model (düzeltilmiş):* tek sunucu bulut. Dezavantaj: internet kesilince garson çalışmaz → hedefe aykırı.
2. *Ayrı Windows hizmeti (Node servisi) + Electron yalnızca arayüz:* kasa uygulaması kapansa bile sunucu çalışır, çökme izolasyonu iyi; kurulum karmaşıklığı artar. İlk sürümde Electron main yeterli, API sınırı temiz tutulursa sonra ayrılabilir.
3. *Bulut-öncelikli (Supabase/Firebase vb.):* çoklu şube kolay, çevrimdışı zayıf, dış bağımlılık/maliyet; ilk hedefle uyumsuz.
4. *Yerel mobil uygulama (React Native vb.):* mağaza ve çift kod tabanı gerektirir; PWA yetmezse sonra; aynı API korunduğu için geçiş maliyeti düşük.

Gerekçe: tek doğruluk kaynağı + yerel ağ bağımsızlığı en az karmaşıklıkla hedefi karşılar; mevcut Electron/Express/ws ve ESC/POS kodu yeniden kullanılır.

## 10. Uygulama aşamaları ve kabul kriterleri
Ayrıntı 04 belgesinde (Aşama 1–5). Mobil için özet:
1. Veri main sürece (SQLite) — kabul: kasa yeniden başlatma/çökmede kayıp yok.
2. API sözleşmesi: `POST /orders` (clientOrderId), `GET /tables` + WS olayları, cihaz eşleme, PIN oturumu — kabul: aynı istek iki kez → tek kayıt; yetkisiz → 401.
3. PWA: manifest, SW, yerel varlıklar, durum rozetleri — kabul: internetsiz Wi-Fi'de 3 telefon eşzamanlı; kasa kapalıyken net hata.
4. Yazdırma kuyruğu bağlama — kabul: yazıcı kapalı → "başarısız" görünür, açılınca tek çıktı.
5. Sertleştirme: güvenlik duvarı kuralı, otomatik başlatma, hız sınırı, denetim günlüğü.
6. Saha testi (05 belgesi 6, 8, 9, 11, 24, 25 numaralı senaryolar).

Her adımda mevcut kodla ilişki: `restaurantDataService.processIncomingOrder/transferTable/updateTableOrder` iş kuralları sunucu servisine taşınır; `printerService`/`electron/printer.ts` ESC/POS üretimi korunur; `garson/index.html` UI korunur, `apiFetch`/`confirmAndSendKitchen`/pairing akışı yeniden yazılır; `index.php` yalnızca bulut rolü için sonraya bırakılır.
