# Bilinen sınırlamalar ve açık işler

Dürüst liste: aşağıdakiler **yapılmadı veya eksik**.

## Doğrulanmamış (donanım/ortam gerektirir)
[testing.md › 5](testing.md) listesindeki 9 madde (fiziksel yazıcı, gerçek telefonlar, gerçek hosting, platform entegrasyonları…).

## Yemek platformu entegrasyonları
- **Canlı hesapla doğrulanmadı.** Platform anahtarları ve ortamı olmadan gerçek sipariş akışı denenemedi; testler yalnızca yerel taklit sunucuyla (testlerde) yapıldı.
- Getir uçları (giriş, aktif/onaysız sipariş, onay/hazırla/teslim/iptal) kamuya açık bilgilere göre yazıldı; payload alanları tolerant çözülür, farklıysa tanı ekranındaki ham gövdeden düzeltilmelidir.
- **Trendyol Go Yemek ve Yemeksepeti** için sipariş okuma/onay/ret/teslim uç adresleri doğrulanamadı; ayarlardaki "gelişmiş adres" alanları doldurulana kadar bu eylemler platforma OTOMATİK iletilmez (ekranda "elle" görünür). Sipariş almak için platformun webhook'u adresimize kaydetmesi gerekir (hesap yöneticisi/partner paneli).

## Güncelleme sistemi
- **Kod imzalama sertifikası yok:** kurulum/güncelleme paketleri imzasız; bütünlük yalnızca SHA-512 + HTTPS ile korunur (yayın sunucusu ele geçirilirse saldırgan paketi değiştirebilir). Windows SmartScreen uyarı verir. Sertifika alınınca bkz. [updates.md › Kod imzalama](updates.md).
- Sunucu (PHP) güncellemesi **otomatik değildir** (hosting erişimim yok): zip yükleme + doğrulama adımları belgelidir.
- Kritik güvenlik güncellemesi **açık adisyon varken kurulmaz** (veri güvenliği tercihi); adisyonlar kapanmazsa gecikir.
- Otomatik geri sürüme dönüş yoktur (güncelleyici düşürmeyi bilerek reddeder); geri dönüş = önceki kurulum dosyasını elle kurmak + gerekirse anlık görüntüyü geri yüklemek.
- Test edilemeyenler: gerçek hosting üzerinden indirme, imza doğrulama, iOS/Android arka plan davranışı, kurulum sırasında elektrik kesintisi.

## Ürün seçenekleri
- Hammadde/reçete **maliyeti ürün başınadır** (seçenek başına değil); seçenekli üründe kâr marjı sütunu "—" gösterilir.
- Seçenekli üründe eski 0,5x / 1,5x çarpanı kullanılmaz (seçenekler onun yerine geçer). Seçeneksiz ürünlerde çarpan aynen çalışır.
- Yemek platformlarından (Getir/Trendyol/Yemeksepeti) gelen siparişler platformun gönderdiği ürün adıyla gelir; platform menüsündeki boyutlar bu seçeneklerle otomatik eşlenmez.
- Seçenek eklenen/kaldırılan ürünler, kasa sunucuya eşitleyince (birkaç saniye) garson ve QR menüde güncellenir; açık sepetteki eski seçenek reddedilirse "Menüyü yenileyin" uyarısı çıkar.

## Mimari
- **Veri modeli hâlâ anahtar-değer (JSON) tabanlı.** Dayanıklılık SQLite ile çözüldü; ancak adisyon satırı, ödeme, stok hareketi gibi kayıtlar **ilişkisel tablolara bölünmedi** (SQL ile raporlama, kısıtlar, satır düzeyi denetim yok). Yeni özellikler (stok, çoklu şube) bunu gerektirecek; geçiş için doğrulamalı göç aracı gerekir.
- **Kasa tek istasyon varsayar.** İkinci bir kasa bilgisayarı aynı veriyi paylaşamaz (tek örnek kilidi iki pencereyi engeller; ağ üzerinden çoklu kasa yok).
- **Çoklu şube, KDS (mutfak ekranı), stok/reçete maliyeti, online sipariş sayfası** yok (yol haritasında).
- Telefonda **çevrimdışı sipariş kuyruğu ve anlık bildirim (push) yok** (bilinçli: [waiter-app.md](waiter-app.md)).
- Bulut ↔ kasa eşzamanlama toplu-durum göndermesidir; kasa gönderirken sunucudaki masa görünümü ~1,5 sn geri kalabilir (sipariş kaybolmaz; `siparisler` kuyruğunda durur).
- Bulut tarafında eski şema kalıntısı tablolar (`categories`, `products`, `tables`, `orders`…) kullanılmıyor.

## Mali kurallar (işletme onayı gerekir)
- **KDV tek oran %10.** Ürün bazlı oran (ör. alkol %20) yok.
- **İş günü kesme saati 05:00** varsayımdır (`src/utils/businessDate.ts`); farklıysa tek satırdan değişir.
- İndirim/iade için ayrı bir modül yok; indirim/ikram mevcut ödeme tipi ve ikram işareti ile temsil edilir. Gerçek "iade/ters kayıt" işlemi ve yetkili onay akışı yok.
- Z raporunda varsayılan **kasa açılış tutarı 1000 ₺** mevcut koddan devralınmıştır; gün sonunda kasa ekranından girilen değer kullanılır.
- Cari borç, adisyon kapandıktan sonra yazılır (kasa uygulaması çökerse arada cari borcun yazılmaması ihtimali çok küçüktür ama sıfır değildir; tek işlem yapısı SQLite ilişkisel göçle gelecektir).

## Güvenlik
[security.md › 5](security.md): garson PIN'leri bulutta düz metin, yedekler şifresiz, kod imzası yok, 2 orta seviye bağımlılık bildirimi (`exceljs`→`uuid`).
**Git geçmişindeki eski sırların iptali sizin yapmanız gereken manuel işlemdir** ([security.md › 1](security.md)).

## Yazdırma
- **Fişler varsayılan olarak GRAFİK basılır** (Segoe UI/Arial ile görüntü olarak; Türkçe karakterler tam). Gerçek yazıcıda ilk fişte boyut/koyuluk denenmelidir; gerekirse yazıcı ayarından "Yazıcının kendi yazı tipi" (metin) seçilir (Türkçe karakter yok, daha hızlı). Grafik üretilemezse otomatik metin baskısına düşülür. Gerçek fiziksel yazıcıyla **denenmedi** (yalnızca görüntü önizlemesi ve sahte ağ yazıcısı).
- USB/Windows sürücülü yazıcılarda ham (RAW) grafik desteği sürücüye bağlıdır; çalışmazsa metin moduna alın.
- Windows spooler yolunda yazıcının **gerçekten çevrimiçi** olduğu işletim sisteminden okunamıyor (Electron 45 `status` alanını kaldırdı); durum "hazır (doğrulanmadı)" gösterilir. Ağ yazıcısında (TCP 9100) bağlantı hatası gerçektir.
- Otomatik yeniden denemede, yazıcı fişi basıp bağlantı hatası bildirirse **çift fiş** olabilir (nadir; kuyruk ekranında "kopya" ve deneme sayısı görünür).

## Test/Altyapı
- Sunucu testleri MariaDB ile yapıldı; üretim MySQL sürümünde küçük farklar olabilir (kullanılan SQL standarttır).
- Kod imzalama, otomatik güncelleme sunucusu (electron-updater) kurulmadı; güncelleme elle ([deployment.md](deployment.md)).
