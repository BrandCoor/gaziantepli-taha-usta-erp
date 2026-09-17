---
description: "Garson web girişini, QR cihaz eşleştirmesini, masa-adisyon-kasa akışını ve PHP hosting veritabanı senkronizasyonunu mevcut işlevleri bozmadan düzelt"
name: "Garson Kiosk ve Senkronizasyonu Düzelt"
argument-hint: "Düzeltilecek belirtiyi, hata mesajını veya ilgili akışı yazın"
agent: "agent"
---

Bu workspace'te aşağıdaki kapsamı uçtan uca incele ve gerekli kod değişikliklerini yap:

- Garsonlar, `garson.rymedya.com.tr` üzerinden giriş yapabilmeli.
- Yeni bir cihaz/telefon ilk kez bağlandığında MAC adresi kayıtlı değilse güvenli bir QR eşleştirme akışı gösterilmeli.
- QR ile başarıyla eşleştirilen telefonlarda sonraki girişlerde doğrudan şifre ekranı açılmalı; cihaz tekrar eşleştirme istememeli.
- Garsonların masa ve adisyon işlemleri kasadaki POS akışıyla tutarlı ve senkron çalışmalı.
- Kalıcı veriler hosting üzerindeki PHP API aracılığıyla phpMyAdmin'deki MySQL veritabanına yazılmalı ve istemciler arasında senkronize edilmeli.
- Mevcut müşteri, personel, kasa, yazıcı, çevrimdışı çalışma ve diğer işlevleri bozma.
- Üretim PHP API sözleşmesi mevcut kodla uyumlu değilse geriye dönük uyumlu yeni endpoint/model sözleşmesi tasarla ve kurulum dokümanını güncelle.
- QR eşleştirme başlatma yetkisini hem yetkili kasa/yönetici ekranına hem de izin verilen garson akışına ver; her iki akışta da aynı sunucu tarafı yetki ve tek kullanımlık token kurallarını uygula.

Uygulama kuralları:

1. Önce ilgili kodu ve veri akışını keşfet. Özellikle `[src/App.tsx](../../src/App.tsx)`, `[src/services/dataService.ts](../../src/services/dataService.ts)`, `[src/services/realtimeSyncService.ts](../../src/services/realtimeSyncService.ts)`, `[src/modules/waiter](../../src/modules/waiter)`, `[electron/server.ts](../../electron/server.ts)`, `[cpanel-yuklenecekler/api](../../cpanel-yuklenecekler/api)` ve `[prisma/schema.prisma](../../prisma/schema.prisma)` dosyalarını yalnızca gerektiği kadar incele. Mevcut API sözleşmelerini, kimlik doğrulamayı, cihaz tanımlamasını, masa/adisyon modellerini ve offline davranışını tespit et.
2. Sorunun kök nedenini kısa ve somut biçimde belirt. Değişiklik yapmadan önce şu hipotezi doğrulayacak en ucuz kontrolü tanımla: istemci, Electron/PHP API ve MySQL arasında aynı kayıt kimliği ve senkronizasyon kuralları korunuyor mu?
3. En küçük uyumlu değişikliği yap. Var olan public API'leri ve veri formatlarını gereksiz yere değiştirme. Yeni bir alan veya endpoint gerekiyorsa geriye dönük uyumluluğu koru ve hem yerel Prisma şemasını hem PHP/MySQL kurulum SQL'ini güncelle.
4. QR eşleştirmesinde ham MAC adresini tek başına güvenlik sırrı kabul etme. Tek kullanımlık, süresi sınırlı bir eşleştirme belirteci kullan; belirteci sunucuda doğrula, eşleştirme sonrası cihaz kimliğini ve garson hesabını bağla, tekrar kullanımını engelle. HTTPS, yetkilendirme, token süresi, başarısız denemeler ve cihaz kaldırma davranışını mevcut mimariye uygun şekilde ele al.
5. Başarılı eşleştirmeden sonra oturum akışını açıkça ayır: eşleşmemiş cihaz QR akışına, eşleşmiş cihaz şifre akışına gitmeli. Yetkisiz bir cihaz masa/adisyon/kasa verisine erişememeli.
6. Masa ve adisyon işlemlerinde yarış durumlarını ve yinelenen istekleri önle. Sipariş/adisyon oluşturma, güncelleme, ödeme/kapatma ve iptal işlemlerinde kimlik, durum geçişi, toplam tutar ve son güncelleme zamanını tutarlı koru. Kasa ve garson ekranında aynı değişikliklerin güncellendiğini doğrula; mümkünse mevcut realtime/offline kuyruğu ve tekrar deneme mekanizmasını kullan.
7. PHP API ile MySQL tarafında prepared statement, transaction, yetki kontrolü ve güvenli hata yanıtları kullan. Şema değişikliklerini `[cpanel-yuklenecekler/database.sql](../../cpanel-yuklenecekler/database.sql)`, `[cpanel-yuklenecekler/veritabani_kurulum.sql](../../cpanel-yuklenecekler/veritabani_kurulum.sql)` ve ilgili README kurulum adımlarıyla uyumlu tut. Gizli bilgileri kaynak koda veya loglara yazma.
8. Ortam farklarını açıkça ele al: geliştirme için Prisma/SQLite veya yerel API, üretim için hosting PHP/MySQL. Üretim bilgilerini `.env` veya mevcut config düzeni dışında sabitleme. PHP API erişilemezse mevcut offline davranışını koru; veri kaybına yol açacak sessiz başarısızlık bırakma.
9. Önce ilgili dar testleri veya typecheck/build komutunu çalıştır. Sonra en az şu kabul senaryolarını doğrula:
   - Yeni garson hesabı ve eşleşmemiş telefon QR ekranına gider.
   - Geçerli QR eşleştirmesi telefonu garson cihazına bağlar ve sonrasında şifre ekranı açılır.
   - Süresi dolmuş, tekrar kullanılmış veya başka hesaba ait QR reddedilir.
   - Eşleşmiş cihaz yanlış garsonun verisine erişemez.
   - Garsonun masa/adisyon değişikliği kasada görünür; kasadaki durum değişikliği garsonda görünür.
   - Aynı istek tekrarlandığında çift adisyon/sipariş oluşmaz.
   - PHP/MySQL yazma ve okuma akışı çalışır; API kesintisinde mevcut offline kuyruğu bozulmaz.
10. Değişikliklerden sonra ilgili testleri, `npm` scriptlerini ve mümkünse PHP API için bir sağlık kontrolünü çalıştır. Çalıştırılamayan kontrolleri nedenleriyle belirt; başarılı kontrollerin komutlarını ve sonuçlarını raporla.

Çıktı formatı:

- **Kök neden:** En fazla birkaç cümle.
- **Yapılan değişiklikler:** Dosya yolları ve davranış bazında kısa liste.
- **Güvenlik ve veri tutarlılığı:** QR, yetki, transaction, idempotency ve offline/senkron kararları.
- **Doğrulama:** Çalıştırılan komutlar, test sonuçları ve varsa kalan riskler.

İlgisiz refactor yapma, dosya silme veya git commit oluşturma. Belirsiz bir üretim sözleşmesi varsa varsayım uydurmak yerine mevcut README, API ve şema kaynaklarından çıkarım yap; çözülemeyen noktayı raporda açıkça belirt.
