# Geliştirme & Test Ortamı (Kendi Bilgisayarınızda)

Bu belge, sistemi **kasa bilgisayarına kurmadan önce** kendi bilgisayarınızda
(VS Code ile) eksiksiz çalıştırıp test etmeniz içindir.

---

## Neden PHP gerekiyor?

Sistem iki parçadan oluşur:

| Parça | Çalıştıran | Test için gereken |
|---|---|---|
| Kasa arayüzü | `npm run dev` (Vite) | Node.js |
| Sunucu (garson girişi, QR menü, senkronizasyon) | PHP dosyaları | **PHP** |

Garson uygulaması PIN'i **sunucuya** sorar. PHP çalışmıyorsa sunucu yoktur,
PIN sorgulanamaz ve giriş denemesi başarısız olur. Bu yüzden garson girişini
test edeceksiniz PHP şart.

> **İyi haber:** Test için **MySQL kurmanıza gerek yok.** Veritabanı bilgisi
> girilmediğinde sunucu otomatik olarak JSON dosya moduna geçer ve garson
> girişi, sipariş akışı, menü senkronizasyonu — hepsi çalışır. MySQL'i
> gerçek hosting'e geçerken kurarsınız.

---

## 1. PHP Kurulumu (bir kez)

En kolay yol **XAMPP**:

1. [https://www.apachefriends.org](https://www.apachefriends.org) adresinden XAMPP'ı indirip kurun
2. PHP'yi komut satırından çağırabilmek için PATH'e ekleyin:
   - Windows arama → **"ortam değişkenleri"** → *Sistem ortam değişkenlerini düzenle*
   - **Ortam Değişkenleri** → `Path` satırını seçip **Düzenle**
   - **Yeni** → `C:\xampp\php` yazın → Tamam
3. **Yeni** bir komut istemi açıp doğrulayın:

```bash
php -v
```

`PHP 8.x.x ...` yazması gerekir.

> XAMPP'ın Apache/MySQL panelini **başlatmanıza gerek yok** — sadece `php.exe`
> dosyası lazım. Sunucuyu PHP'nin kendi geliştirme sunucusu çalıştıracak.

---

## 2. Her Gün Çalıştırma

Proje klasöründeki **`gelistirme_sunucusu.bat`** dosyasına çift tıklayın.

Bu dosya iki şeyi birden başlatır:

| Adres | Ne |
|---|---|
| `http://localhost:5173` | Kasa arayüzü (kod değişince anında yenilenir) |
| `http://localhost:8080` | Sunucu (API) |
| `http://localhost:8080/garson/` | **Garson uygulaması** |
| `http://localhost:8080/menu/` | QR menü |
| `http://localhost:8080/patron/` | Patron paneli |

Elle başlatmak isterseniz iki ayrı terminal açın:

```bash
# 1. terminal — sunucu
php -S 127.0.0.1:8080 -t cpanel-yuklenecekler

# 2. terminal — kasa arayüzü
npm run dev
```

---

## 3. İlk Kurulum Adımları (bir kez)

1. `http://localhost:5173` adresini açın
2. **Yönetici şifrenizi belirleyin** (program hazır şifre ile gelmez)
3. **Ayarlar → Sistem & Yedekleme** ekranına girin
4. Sunucu adresi alanına **aynen** şunu yazıp **Kaydet**'e basın:

   ```
   http://localhost:8080/api
   ```

   ✅ *"Menü, masalar ve garson PIN kodları sunucu veritabanınıza gönderildi"*
   mesajını görmelisiniz.

5. **Ayarlar → Salon & Masalar**'dan bölüm ve masalarınızı tanımlayın
6. **Ayarlar → Kategoriler / Ürünler**'den menünüzü girin
7. **Ayarlar → Garson Terminalleri**'nden garson ekleyin — PIN otomatik üretilir

---

## 4. Garson Girişini Test Etme

1. Tarayıcıda yeni sekme: `http://localhost:8080/garson/`
2. Kasada gördüğünüz 4 haneli PIN'i girin
3. Giriş yapınca masalar ve menü gelmeli
4. Bir masaya sipariş girip gönderin
5. Kasa ekranında masanın dolduğunu görün

**Telefonunuzdan test etmek isterseniz** (aynı Wi-Fi ağında):

```bash
php -S 0.0.0.0:8080 -t cpanel-yuklenecekler
```

Bilgisayarınızın yerel IP'sini öğrenin (`ipconfig` → IPv4 Adresi, örn.
`192.168.1.25`) ve telefondan açın:

```
http://192.168.1.25:8080/garson/
```

Kasadaki sunucu adresini de `http://192.168.1.25:8080/api` yapın.

> Windows Güvenlik Duvarı ilk seferde izin isteyebilir — **Özel ağlarda izin ver** deyin.

---

## 5. Test Verisini Sıfırlama

JSON modunda tüm sunucu verisi tek dosyada tutulur:

```
cpanel-yuklenecekler/api/restaurant_sync.json
```

Bu dosyayı silmek sunucu tarafını sıfırlar (kasa tarafı etkilenmez).
Dosya `.gitignore`'da olduğu için depoya gönderilmez — içinde garson PIN'leri
ve sipariş verisi bulunur.

Kasa tarafını sıfırlamak için: tarayıcıda **F12 → Application → Local Storage →
Clear**, veya Ayarlar → Sistem & Yedekleme ekranındaki sıfırlama seçenekleri.

---

## 6. Kod Değiştirdiğinizde

| Değiştirdiğiniz yer | Ne yapmalı |
|---|---|
| `src/` (kasa arayüzü) | Hiçbir şey — Vite anında yeniler |
| `cpanel-yuklenecekler/api/*.php` | Hiçbir şey — PHP her istekte yeniden okur |
| `cpanel-yuklenecekler/garson/index.html` | Tarayıcıda **Ctrl+F5** (önbelleği atla) |

Hata kontrolü (commit öncesi önerilir):

```bash
npm run lint     # TypeScript hata kontrolü
npm run build    # üretim derlemesi
```

---

## 7. Test Bitince: Kurulum Dosyası Oluşturma

```bash
npm run electron:build
```

Kurulum dosyası `dist-electron` klasörüne yazılır. Bunu kasa bilgisayarına
taşıyıp kurabilirsiniz.

Kasa bilgisayarında **sunucu adresini gerçek hosting adresinizle değiştirmeyi
unutmayın** (`http://localhost:8080/api` yerine `https://alanadiniz.com/api`).
Hosting kurulumu için **KURULUM.md** belgesine bakın.

---

## Sık Karşılaşılan Sorunlar

### "php is not recognized as an internal or external command"

PHP PATH'e eklenmemiş. Bölüm 1'i tekrarlayın ve **yeni** bir komut istemi açın
(eski pencereler PATH değişikliğini görmez).

### Garson uygulaması "Sunucu adresi bulunamadı" diyor

Garson uygulamasını dosyaya çift tıklayarak (`file:///...`) açmışsınız.
Mutlaka `http://localhost:8080/garson/` adresinden açın — uygulama sunucu
adresini kendi adresinden türetir.

### Garson "Geçersiz PIN kodu" diyor

1. Kasada Ayarlar → Sistem & Yedekleme → sunucu adresi `http://localhost:8080/api` mi?
2. **Kaydet**'e bastığınızda başarı mesajı geldi mi?
3. Sunucu penceresi hâlâ açık mı? (kapanırsa API çalışmaz)
4. `http://localhost:8080/api/index.php?action=test_db` adresi `"success":true` dönüyor mu?

### Kasa ekranında kırmızı "sunucu adresi tanımlı değil" uyarısı

Bölüm 3, adım 4'ü yapın.

### Port 8080 veya 5173 kullanımda

Farklı port verin:

```bash
php -S 127.0.0.1:8090 -t cpanel-yuklenecekler
```

Kasadaki sunucu adresini de `http://localhost:8090/api` olarak güncelleyin.
