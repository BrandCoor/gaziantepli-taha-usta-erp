# Güncelleme sistemi (kasa, sunucu, garson)

Amaç: yeni sürümler için uygulamayı kaldırıp yeniden kurmak gerekmesin; işletme verisi hiçbir güncellemede riske girmesin.
Üç bileşenin her biri **kendi çalışma biçimine uygun** yöntemle güncellenir:

| Bileşen | Yöntem | Kim tetikler | Veri |
|---|---|---|---|
| **Windows kasa** | `electron-updater` (arka planda indirir, güvenli anda sessiz kurar) | Otomatik denetim (açılışta +45 sn, sonra 4 saatte bir) | `userData` klasörü kurulumda silinmez; kurulum öncesi otomatik anlık görüntü + dosya yedeği |
| **Sunucu (API)** | Güncelleme zip'i → cPanel Dosya Yöneticisi (otomatik DEĞİL; hosting erişimi gerekir) | Siz | `config.local.php` zip'te yoktur → ayarlar/anahtarlar ezilmez; şema göçü öncesi SQL yedeği |
| **Garson PWA** | Servis çalışanı "bekleyen sürüm" + sürüm dosyası | Garson ("Güncelle") | Oturum korunur; sepet/gönderim varken uygulanmaz |

Sürüm ve uyumluluk kuralları: [versioning.md](versioning.md).

---

## 1. Kasa (Windows) otomatik güncellemesi

### Nasıl çalışır
1. Kasa açıldıktan 45 sn sonra ve sonra her 4 saatte bir **güncelleme kaynağına** (HTTPS) bakar: `latest.yml` (sürüm + SHA-512) ve `update-policy.json` (notlar, kritik mi).
2. Yeni sürüm varsa **arka planda indirir** (ilerleme üstte görünür). İndirme kesilirse **30 sn → 2 dk → 10 dk → 30 dk → 1 saat** artan aralıkla en fazla 5 kez yeniden dener.
3. İndirilen paketin **SHA-512 özeti** `latest.yml` ile karşılaştırılır. Tek bayt farkta paket **REDDEDİLİR**, tekrar denenmez, kurulamaz, kullanıcıya ve günlüğe bildirilir.
4. Paket hazır olunca banner: **"Yeni sürüm hazır — Şimdi kur"**. Kurulum:
   - **Açık adisyon veya devam eden ödeme varken YAPILMAZ** (düğme pasif; ana süreç de ayrıca reddeder).
   - Kurulumdan önce **veri anlık görüntüsü** (SQLite `VACUUM INTO`) ve **dosya yedeği** ("guncelleme-oncesi") alınır; biri başarısızsa **kurulum durdurulur**.
   - Sessiz kurulum çalışır (sihirbaz açılmaz), bitince uygulama kendiliğinden yeniden açılır (~20-40 sn).
5. "Sonra" derseniz: uygulamayı normal kapattığınızda bekleyen güncelleme **kapanışta otomatik kurulur** (yine anlık görüntü alınır).
6. Geri sürüm / aynı sürüm teklifleri (düşürme saldırısı) **yok sayılır**.

### Normal ve kritik güncelleme
`update-policy.json` ile belirlenir (`--critical`, `--min-supported`, `--deadline`):

| | Normal | Kritik güvenlik |
|---|---|---|
| Bildirim | Bilgi şeridi | Kırmızı, kalıcı uyarı (kapatılamaz) |
| Kurulum | Kullanıcı seçer ya da kapanışta | Açık adisyon/ödeme **kalmadığı ilk anda** (20 sn'de bir denetlenir) yedek alınarak kendiliğinden |
| Ertelenebilir mi | Evet | Yalnızca açık adisyon bitene kadar. **Zorla yeniden başlatma yoktur** (açık adisyon kaybolmasın) |
| Desteklenmeyen sürüm | — | `minSupported`'ın altındaki sürümde "artık desteklenmiyor" uyarısı sürekli görünür; sunucu isterse `MIN_KASA_VERSION` ile eski kasayı 426 ile reddeder (bkz. versioning.md) |

> Sınırsız erteleme riski: kasa gece-gündüz açık adisyonla çalışırsa kritik güncelleme bekler. Bu bilinçli bir ödünleşimdir (veri kaybı > gecikme). `--deadline` tarihi geçince uyarı vurgulanır ve **ilk güvenli anda** kurulur; yöneticinin adisyonları kapatması gerekir.

### Güncelleme kaynağı (merkezi yapılandırma)
Tek yer: **Ayarlar › Bulut & Yedekleme › Uygulama Güncellemesi › Güncelleme adresi**. Çözüm sırası (kodda tek fonksiyon: `resolveFeedUrl`):
1. Ayarlardan girilen adres, 2. `GTU_UPDATE_URL` ortam değişkeni, 3. kurulum paketine gömülü `resources/update-config.json` (`{"feedUrl":"https://..."}`), 4. **API adresinizden türetilen** `<API>/updates/` (varsayılan).
Yalnızca **HTTPS** kabul edilir (yerel test hariç); adreste parola olamaz.

### Dağıtım noktası kurulumu (sizin yapacağınız tek seferlik iş)
Varsayılan: API alt alanınızın içinde `updates/` klasörü (ör. `https://api.rymedya.com.tr/updates/`). API zip'i bu klasörü (`.htaccess` ile) zaten içerir.
- cPanel › Dosya Yöneticisi › `api.rymedya.com.tr` belge kökü › `updates` klasörüne yükleme yapacaksınız.
- Kurulum dosyası ~130 MB: Dosya Yöneticisi yükleme sınırı yetmezse **FTP** (FileZilla) kullanın.
- **Alternatif (hosting'e yük bindirmez):** GitHub Releases. Ayarlar'daki adrese `https://github.com/<hesap>/<depo>/releases/latest/download/` yazın; dosyaları Release'e ekleyin.

### Yeni sürüm yayınlama (adım adım)
```
# 1) sürümü yükselt (kasa + garson PWA; sunucu kodu değiştiyse --api ekle)
node tools/bump-version.cjs 1.2.0 --api 1.2.0
# 2) test et
npm test            # + gerekli e2e'ler (docs/testing.md)
# 3) kasa kurulum dosyasını üret
npm run electron:build
# 4) yayın klasörünü üret (özetleri DOĞRULAR; bozuksa üretmez)
node tools/update-tools.cjs --out "C:\Users\...\YUKLEME_PAKETI" --previous 1.1.0 --notes "Neler değişti..."
#    kritik güvenlik güncellemesi ise:
#    ... --critical --min-supported 1.1.0 --deadline 2026-12-31 --notes "Güvenlik düzeltmesi"
# 5) sunucu/garson paketleri (config.local.php İÇERMEZ)
node tools/make-deploy-package.cjs --update --out "C:\...\YUKLEME_PAKETI" --api https://api.rymedya.com.tr --garson https://garson.rymedya.com.tr --menu https://qr.rymedya.com.tr --patron https://patron.rymedya.com.tr
```
**Yükleme sırası (önemli):** ① sunucu (`1-api-guncelleme.zip`) → ② garson/menü/patron zip'leri → ③ en son `guncelleme` klasörünün içeriğini `updates/` klasörüne. Böylece kasalar yeni sürümü görmeden sunucu hazır olur. `latest.yml` **en son** yüklenmelidir (yüklenene kadar kimse yeni sürümü görmez).

### Kod imzalama (EKSİK — sizden gerekli)
Şu an kurulum dosyası **imzasız**. Sonuçları: (1) Windows SmartScreen "bilinmeyen yayıncı" uyarısı verir, (2) güncelleme bütünlüğü yalnızca **SHA-512 + HTTPS** ile korunur; yayın sunucunuza (cPanel hesabınıza) sızılırsa saldırgan hem dosyayı hem özeti değiştirebilir. **Hesap güvenliğini (2 adımlı doğrulama, güçlü parola) bu yüzden önemsiyoruz.**
İmza için gerekli (ben uyduramam): bir **EV/OV kod imzalama sertifikası** (.pfx) ve parolası. Elinizde olunca: `CSC_LINK=<pfx yolu>` ve `CSC_KEY_PASSWORD=<parola>` ortam değişkenleriyle `npm run electron:build` çalıştırılır (**asla Git'e girmez**); `package.json › build.win` içine `publisherName` eklenir; electron-updater bundan sonra yeni paketin imzasını da denetler. Bu adım yapılana kadar imza doğrulaması **çalışmaz** ve belgelerde "doğrulandı" denmez.

### Hata kaydı
Tüm güncelleme olayları kasa günlüğüne yazılır (`userData\logs`, ayarlardaki günlük görüntüleyici): bulundu, indirildi, reddedildi, yeniden deneme, kurulum, anlık görüntü. Parola/anahtar günlüğe girmez.

---

## 2. İşletme verisini koruma
- Uygulama dosyaları (`Program Files`/kurulum klasörü) ile veri (`%APPDATA%\gaziantepli-taha-usta`: `data\kasa.db`, günlükler) **ayrı yerdedir**; NSIS `deleteAppDataOnUninstall=false` olduğundan güncelleme/kaldırma veriyi silmez.
- Kurulumdan önce: `data\guncelleme-oncesi\kasa_<sürüm>_<tarih>.db` (son 5 tutulur) + `Belgelerim\GaziantepliTahaUsta-Yedekler\yedek_*_guncelleme-oncesi.json`.
- **Veri şeması koruması:** kasa verisi bu uygulamanın anladığından **daha yeni** bir sürümle yazıldıysa uygulama **açılmaz** ve veriye dokunmaz ("DATA_NEWER"). Böylece eski sürüm yanlışlıkla yeni veriyi bozamaz.
- Veritabanı şema göçleri **yalnızca sunucuda** vardır ve ayrıdır (aşağıda).

## 3. Geri dönüş ve kurtarma
**Uygulama sürümüne dönmek ≠ veri şemasına dönmek.** Bu yüzden ikisi ayrı ele alınır:

| Durum | Ne yapılır |
|---|---|
| Güncelleme **indirilemedi / doğrulanamadı** | Hiçbir şey değişmedi; mevcut sürümle çalışmaya devam. Günlüğe bakın, yayını yeniden üretin. |
| Güncelleme sırasında **elektrik/çökme** | Kurulum atomik değildir ama veri klasörü kurulumdan etkilenmez. Bilgisayar açılınca: uygulama açılıyorsa devam; açılmıyorsa **son kurulum dosyasını (`updates/arsiv/`) elle yeniden kurun** (veri korunur). |
| Yeni sürüm **hatalı** (açılıyor ama sorunlu) | 1) `update-policy.json`'u kaldırıp `latest.yml`'u önceki sürüme **geri yayınlamak otomatik geri dönüş yapmaz** (güncelleyici geri sürümü reddeder). 2) Önceki sürümün kurulum dosyasını elle çalıştırın (üstüne kurar, veri korunur). 3) Yeni sürümün kasa verisi şemasını değiştirdiyse eski sürüm açılmayı reddeder (DATA_NEWER) — bu durumda ② anlık görüntüyü geri yükleyin. |
| Veri bozuldu | Kasa › Yedekleme › "guncelleme-oncesi" yedeğini geri yükle; ya da `data\kasa.db`'yi kapalıyken `guncelleme-oncesi\*.db` ile değiştir. |

**Kural:** her yayında önceki sürümün kurulum dosyasını `updates/arsiv/<sürüm>/` altında **saklayın** (silmeyin). Bu, geri dönüş planının temelidir.

---

## 4. Sunucu (API) güncellemesi
Hosting izinleri olmadan sunucuyu uzaktan güncelleyemem; bu yüzden **tekrarlanabilir elle süreç** (cPanel Dosya Yöneticisi veya FTP):
1. **Yedek:** cPanel › Yedekleme › "Ev dizini" + "MySQL veritabanı" yedeklerini indirin (güncellemeden hemen önce). Ek olarak sunucu, şema göçü gerekiyorsa kendisi `api/_yedek/pre-migration-*.sql.gz` alır (alamazsa göçü **uygulamaz**).
2. `api.rymedya.com.tr` belge kökünde `1-api-guncelleme.zip`'i **"Extract"** edin (üzerine yazar). `config.local.php` zip'te **yoktur**; ayarlarınız ve anahtarlarınız kalır.
3. Doğrulama: `https://api.rymedya.com.tr/index.php?action=version` → `apiVersion` yeni sürüm, `schemaVersion` = `schemaExpected`, `migrationError:false`.
4. `migrationError:true` ise: göç **yarım kaldı ve sürüm numarası artmadı**; veri bozulmadı. Hata metni `ayarlar.schema_last_error`'da. Sorunu giderip herhangi bir isteği tekrarlayın (göç yeniden dener) ya da önceki zip'i açıp geri dönün + `_yedek` SQL'ini phpMyAdmin'den içe aktarın.
5. **Geri dönüş:** önceki sürümün `1-api` zip'ini aynı şekilde açın. Şema yalnızca ekleme yaptığı için (sütun/tablo ekler, silmez) eski kod yeni şemayla çalışır; veri kaybı olmaz.

Göç güvenceleri (testli): eşzamanlı çalışma kilidi · göç öncesi SQL yedeği · "zaten var" dışındaki her hatada durma ve sürümü artırmama · tekrar çalıştırılabilirlik (idempotent) · veri silen göç yok.

## 5. Garson PWA güncellemesi
- Yeni sürüm dosyaları yüklenince telefon, uygulamayı açtığında / her 30 dakikada bir / arka plandan dönünce yeni sürümü **arka planda indirir** ("bekleyen" servis çalışanı). Eski ve yeni dosyalar **karışmaz** (statik dosyalar önce ağdan alınır; eski önbellek yeni sürüm devreye girince silinir).
- Garsona şerit çıkar: **"Yeni sürüm hazır — Güncelle"**. Sepette ürün varken ya da sipariş gönderilirken **uygulanmaz** ("Siparişi tamamlayıp tekrar deneyin"). Sayfa kendiliğinden yenilenmez.
- Giriş (oturum) güncelleme sonrası korunur (12 saat).
- Sunucu çok eski garson sürümünü **426** ile reddeder; garson "Güncelleyin" uyarısı görür, sepet yerinde kalır, sipariş kaybolmaz.
- **Sınır:** PWA bir mağaza uygulaması değildir; işletim sistemi (özellikle iOS) arka plan güncellemesini kısıtlayabilir. Bu yüzden sayfa açıldığında ve öne gelince de açıkça denetlenir. Garsonun uygulamayı en az günde bir kez açması yeterlidir. Kaldırıp yeniden kurmak gerekmez.

---

## 6. Test edilenler ve edilemeyenler
Gerçek işletme verisi **kullanılmadı**; ayrı `--user-data-dir`, ayrı test veritabanı.

| # | Senaryo | Nasıl | Sonuç |
|---|---|---|---|
| 1 | Yeni sürüm yokken normal çalışma | Gerçek kurulu uygulama + yerel yayın sunucusu (`tools/dev/e2e-updater.cjs`) | ✔ "güncel" |
| 2 | Yeni sürüm bulunur, indirilir, doğrulanır | aynı | ✔ |
| 3 | İndirme sırasında internet kesilmesi | Birim testi (sahte güncelleyici; artan aralıklı yeniden deneme, 5 deneme sınırı) | ✔ birim; **gerçek ağ kesintisi elle denenmedi** |
| 4 | Bozuk paket reddi | Gerçek uygulama: tek bayt bozuk paket → "reddedildi", sürüm değişmedi; ayrıca `update-tools` bozuk yayını üretmez | ✔ |
| 5 | Güncelleme sırasında kapanma | Kurulum, açık adisyon varken engellenir; uygulama kapanırken anlık görüntü alınır | ✔ kısmen (**kurulum sırasında elektriğin kesilmesi** fiziksel olarak denenmedi) |
| 6 | Güncelleme sonrası açılış | Gerçek: 1.1.0 → 1.1.1 sessiz kurulum, yeniden açıldı | ✔ |
| 7 | İşletme verisi korunması | Gerçek: kurulumdan önce yazılan kayıt sonra okundu | ✔ |
| 8 | Göç başarısızlığı | PHP+MySQL entegrasyon testi: sürüm artmaz, hata kaydı, veri bozulmaz, düzelince tamamlanır | ✔ |
| 9 | Sunucu güncellemesi sonrası API | Entegrasyon testi (`version`, gate, idempotent göç + yedek) | ✔ test ortamı; **gerçek cPanel'de sizin ilk güncellemenizde doğrulanacak** |
| 10 | Mobil yeni sürüm | Gerçek Edge + servis çalışanı (`tools/dev/pwa-update-check.cjs`): bekleyen sürüm, bildirim, sepet doluyken uygulanmaz, boşken uygulanır, önbellek/oturum | ✔ **gerçek iPhone/Android denenmedi** |
| 11 | Eski istemci / uyumsuz sürüm | Entegrasyon testi: 426, işlem yapılmaz | ✔ |
| 12 | Hatalı güncelleme sonrası kurtarma | Anlık görüntü + "DATA_NEWER" koruması + belgelenmiş adımlar | ✔ mekanizma; **tam geri yükleme tatbikatı elle yapılmalı** |

**Test EDİLEMEYENLER (açıkça):** imzalı yayında Windows imza doğrulaması (sertifika yok); gerçek `https://api.rymedya.com.tr/updates/` üzerinden indirme (sunucuya erişimim yok); hosting yükleme sınırları; iOS/Android arka plan davranışı; Windows SmartScreen/antivirüs tepkileri; çok kasalı kurulum (desteklenmiyor).

## 7. Sizden gerekenler
1. **Güncelleme yayın yeri:** `api.rymedya.com.tr` içinde `updates` klasörü (varsayılan) **ya da** GitHub Releases — hangisini istediğinizi söyleyin.
2. **Kod imzalama sertifikası** (.pfx + parola) — alınana kadar imzasız çalışır.
3. İlk gerçek güncellemede sunucu yedeğini (cPanel) siz alıp yüklemeyi birlikte yapalım.
