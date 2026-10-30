> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

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
