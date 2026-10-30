> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

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
