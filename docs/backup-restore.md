# Yedekleme ve geri yükleme

## Ne zaman, nereye yedek alınır

| Tür | Ne zaman | Dosya adı |
|---|---|---|
| Otomatik | Açılıştan 30 sn sonra ve **her 6 saatte bir** | `yedek_<tarih>_otomatik.json` |
| Z kapanışı | Her Z raporu sonrası | `…_z-kapanis.json` |
| Elle | Restoran & Donanım Ayarları › Bulut & Yedekleme › **Şimdi Yedek Al** | `…_elle.json` |
| Güvenlik yedeği | Geri yüklemeden, bulut verisini çekmeden, fabrika sıfırlamadan **önce** (otomatik) | `…_geri-yukleme-oncesi.json`, `…_bulut-cekme-oncesi.json`, `…_fabrika-oncesi.json` |

- Birincil klasör: **`Belgelerim\GaziantepliTahaUsta-Yedekler\`**
- **İkinci kopya (önerilir):** Aynı ekrandan *İkinci Kopya Klasörü Seç* ile USB bellek veya ikinci diski seçin; her yedek oraya da yazılır. Yedek aynı disk bozulursa yetmez.
- Otomatik yedeklerden **son 60** tane tutulur; elle, Z, güvenlik yedekleri **asla otomatik silinmez**.
- Her yedek yazılırken: geçici dosyaya yazılır → geri okunup **SHA-256 ile doğrulanır** → yeniden adlandırılır (yarım dosya kalmaz).

Yedeğe giren: adisyon arşivi, Z raporları, iptal kayıtları, cari/toptancı hareketleri, giderler, ürün/menü, personel, kullanıcılar, yazıcı ve ayarlar, masalar (açık adisyonlar). **Girmeyen:** Kasa API anahtarı, cihaz belirteçleri, geçici kuyruklar.

> Yedek dosyaları kişisel veri ve parola **özetleri** içerir ve şifresizdir. Güvenli yerde saklayın, yabancılarla paylaşmayın.

## Geri yükleme (aynı veya yeni bilgisayar)

1. Yeni bilgisayarda kurulum paketini çalıştırın, uygulamayı açın. (İlk kurulum ekranı gelirse yönetici hesabını geçici olarak oluşturun — yedeğin kullanıcıları geri yüklenince değişir.)
2. Restoran & Donanım Ayarları › Bulut & Yedekleme › **Dosyadan Geri Yükle…** (yedek `.json` dosyasını seçin) **veya** listeden *Geri Yükle*.
3. Onaylayın. Uygulama sırayla şunları yapar:
   1. Mevcut verinin **güvenlik yedeğini** alır — **alınamazsa işlem iptal edilir**.
   2. Yedeği uygular (yedeklenebilir tüm anahtarlar değiştirilir; yedekte olmayan eski kalıntılar temizlenir).
   3. Kayıt sayılarını (adisyon, Z, cari hareket, müşteri, ürün…) yedekteki sayılarla **karşılaştırır**; uyuşmazsa önceki durumu **otomatik geri yükler** ve hata verir.
4. Başarılıysa uygulama yeniden yüklenir. *Sunucu adresi ve Kasa API Anahtarı* yedekte **sır olduğu için anahtar yoktur**: Restoran & Donanım Ayarları'ndan yeniden girin.

Geri yükleme SQLite deposuna da işlenir (testle doğrulandı).

## Çökme / elektrik kesintisi

Veri SQLite'ta (`%APPDATA%\gaziantepli-taha-usta\data\kasa.db`) her yazmada COMMIT edilir. Açılışta uygulama veriyi oradan yükler; Chromium'un yerel deposu bozulsa/silinse bile veri geri gelir. Ayrıca: `kasa.db`, `kasa.db-wal` dosyalarını **uygulama kapalıyken** kopyalayarak da elle yedek alabilirsiniz.

## Sunucu (MySQL) yedeği

Bulut veritabanı kasanın bir **aynasıdır** (asıl kasa verisi kasadadır) ama garson cihaz eşleşmeleri ve bekleyen siparişler orada durur. cPanel › *Yedekleme* veya phpMyAdmin › *Dışa Aktar* ile düzenli yedek alın. Yeni sunucuya taşırken: veritabanını içe aktarın, `config.local.php` oluşturun (bkz. [deployment.md](deployment.md)); kasa verisi zaten kasadadır, kasa tekrar bağlanınca ayna yeniden dolar.

## Yedeğin çalıştığını doğrulama (öneri: ayda bir)

1. *Şimdi Yedek Al* → "Yedek Alındı ve Doğrulandı" mesajını ve kayıt sayılarını görün.
2. Test bilgisayarında bu dosyayı geri yükleyip adisyon/cari toplamlarını karşılaştırın.
