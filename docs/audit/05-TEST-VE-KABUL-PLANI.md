> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

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
