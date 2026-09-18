# Gaziantepli Taha Usta ERP & POS — Kurulum Kılavuzu

Bu belge sistemi **sıfırdan, eksiksiz çalışır halde** kurmanız için hazırlandı.

Sistem **iki parçadan** oluşur ve **ikisi de kurulmadan** garsonlar telefondan giriş yapamaz:

| Parça | Nerede çalışır | Ne işe yarar |
|---|---|---|
| **Kasa programı** | Restorandaki Windows bilgisayar | Masalar, adisyon, ödeme, yazıcılar, raporlar |
| **Sunucu dosyaları** | Kendi hosting'iniz (cPanel + MySQL) | Garson telefonları, QR menü ve patron paneli buraya bağlanır |

> **En sık yapılan hata:** Sadece kasa programını kurup sunucu adresini girmemek.
> Bu durumda garson PIN'leri yalnızca kasa bilgisayarında kalır, sunucuya
> yazılmaz ve garson telefondan giriş yapmaya çalıştığında **"Geçersiz PIN kodu"**
> uyarısı alır. Bölüm 2 ve 3 bu yüzden zorunludur.

---

## BÖLÜM 1 — Kasa Bilgisayarına Kurulum

### 1.1 Node.js kurun

[https://nodejs.org](https://nodejs.org) adresinden **LTS** sürümünü indirip ileri-ileri diyerek kurun.

### 1.2 Projeyi bilgisayara indirin

Masaüstünde bir klasör açın, içinde komut istemi (CMD) çalıştırın:

```bash
git clone -b claude/affectionate-ptolemy-7zjxnl https://github.com/BrandCoor/gaziantepli-taha-usta-erp.git "Taha Usta POS"
cd "Taha Usta POS"
```

Git kurulu değilse GitHub'daki **Code → Download ZIP** ile indirip klasöre çıkarın.

### 1.3 Kurulum sihirbazını çalıştırın

Proje klasöründeki **`kurulum_ve_setup.bat`** dosyasına çift tıklayın. Bu dosya:

1. Node.js kurulu mu kontrol eder
2. Gerekli paketleri yükler (`npm install`)
3. Programı derler (`npm run build`)
4. Masaüstüne **"Gaziantepli Taha Usta POS"** kısayolu oluşturur

Kısayola çift tıklayarak programı tam ekran açabilirsiniz.

### 1.4 (İsteğe bağlı) Kurulum dosyası (.exe) oluşturma

```bash
npm run electron:build
```

Oluşan kurulum dosyası `dist-electron` klasörüne yazılır.

### 1.5 İlk açılış: yönetici şifrenizi belirleyin

Program **hazır şifre ile gelmez**. İlk açılışta giriş ekranı sizden yönetici
şifresi belirlemenizi ister (en az 4 karakter). Bu şifreyi not edin.

---

## BÖLÜM 2 — Hosting (Sunucu) Kurulumu

Garsonların telefondan giriş yapabilmesi için bu bölüm **zorunludur**.

### 2.1 cPanel'de veritabanı oluşturun

cPanel → **MySQL® Veritabanları**:

1. Yeni bir veritabanı oluşturun (örn. `isletme_taha`)
2. Yeni bir kullanıcı oluşturun ve güçlü bir şifre verin
3. Kullanıcıyı veritabanına ekleyin ve **ALL PRIVILEGES** (tüm yetkiler) verin
4. Veritabanı adı, kullanıcı adı ve şifreyi bir yere not edin

> Tabloları elle oluşturmanıza gerek yok. Sistem ilk istekte tüm tabloları kendisi kurar.

### 2.2 Veritabanı bilgilerini yazın

Proje klasöründe `cpanel-yuklenecekler/api/` klasörüne girin:

1. `config.local.example.php` dosyasını **kopyalayın**
2. Kopyanın adını **`config.local.php`** yapın
3. İçini kendi bilgilerinizle doldurun:

```php
return [
    'host' => 'localhost',
    'port' => '3306',
    'name' => 'isletme_taha',      // cPanel veritabanı adı
    'user' => 'isletme_tahausr',   // cPanel veritabanı kullanıcısı
    'pass' => 'buraya-sifreniz',   // veritabanı şifresi
];
```

> Bu dosya git deposuna gönderilmez; şifreniz yalnızca kendi sunucunuzda kalır.

### 2.3 Dosyaları hosting'e yükleyin

`cpanel-yuklenecekler` klasörünün **içindeki** 4 klasörü, cPanel Dosya
Yöneticisi veya FTP ile `public_html` içine yükleyin. Klasör yapısı **tam olarak**
şöyle olmalıdır:

```
public_html/
├── api/          ← index.php, auth.php, config.php, config.local.php, online/
├── garson/       ← garsonların telefondan açacağı adres
├── menu/         ← müşterilerin QR menüsü
└── patron/       ← uzaktan ciro takip paneli
```

> **Önemli:** `garson` klasörü `api` klasörü ile **aynı seviyede** olmalıdır.
> Garson uygulaması sunucuyu `../api/index.php` yolundan bulur; klasörleri
> farklı yerlere koyarsanız bağlantı kurulamaz.

### 2.4 Bağlantıyı test edin

Tarayıcıdan şu adresi açın:

```
https://alanadiniz.com/api/index.php?action=test_db
```

Görmeniz gereken (`"mode":"MYSQL"` kısmı önemlidir):

```json
{"success":true,"mode":"MYSQL","database":"isletme_taha", ...}
```

| Gördüğünüz | Anlamı | Ne yapmalı |
|---|---|---|
| `"mode":"MYSQL"` | Her şey doğru | Devam edin |
| `"mode":"JSON_FALLBACK"` | `config.local.php` okunamıyor | Dosya adını ve konumunu kontrol edin |
| `"mode":"MYSQL_ERROR"` | Veritabanı bilgileri hatalı | Ad/kullanıcı/şifreyi kontrol edin |
| Sayfa açılmıyor | Dosyalar yanlış yerde | Klasör yapısını kontrol edin |

---

## BÖLÜM 3 — Kasayı Sunucuya Bağlama

Bu adım atlanırsa **garsonlar telefondan giriş yapamaz.**

1. Kasa programını açın
2. **Ayarlar → Sistem & Yedekleme** ekranına girin
3. **Sunucu / API Adresi** alanına yazın:

   ```
   https://alanadiniz.com/api
   ```

4. **Kaydet**'e basın

Kaydettiğiniz anda menü, masalar ve **garson PIN kodları** sunucu veritabanınıza
gönderilir. Ekranda şunu görmelisiniz:

> ✅ *"Menü, masalar ve garson PIN kodları sunucu veritabanınıza gönderildi.
> Garsonlar artık telefondan PIN ile giriş yapabilir."*

Kırmızı bir hata görürseniz adres yanlıştır — Bölüm 2.4'teki testi tekrarlayın.

Ayrıca **Ayarlar → Garson Terminalleri** ekranındaki **Uygulama Adresi**
düğmesine basıp garson uygulamasının adresini girin:

```
https://alanadiniz.com/garson
```

---

## BÖLÜM 4 — Garson Tanımlama ve Test

1. Kasada **Ayarlar → Garson Terminalleri** ekranına girin
2. **+ Yeni Garson Tanımla** ile garsonu ekleyin — PIN kodu otomatik ve
   benzersiz olarak üretilir (isterseniz değiştirebilirsiniz)
3. Kartta görünen **4 haneli PIN**'i garsona verin
4. Garson telefonundan `https://alanadiniz.com/garson` adresini açar
5. PIN'ini girer ve içeri girer

Giriş başarılı olduğunda kasadaki kart **"Giriş Yaptı"** durumuna geçer ve
garsonun kullandığı telefon kaydedilir.

**Telefona uygulama gibi eklemek için:** Telefonda adresi açtıktan sonra
tarayıcı menüsünden *"Ana ekrana ekle"* deyin.

---

## BÖLÜM 5 — Sorun Giderme

### "Geçersiz PIN kodu" diyor ama PIN doğru

Sırayla kontrol edin:

1. **Kasada sunucu adresi girili mi?**
   Garson Terminalleri ekranında kırmızı uyarı varsa adres girilmemiştir → Bölüm 3.

2. **Sunucu MySQL moduna geçti mi?**
   `https://alanadiniz.com/api/index.php?action=test_db` adresinde
   `"mode":"MYSQL"` yazmalı → Bölüm 2.4.

3. **PIN sunucuya ulaştı mı?**
   Kasada Ayarlar → Sistem & Yedekleme → **Kaydet**'e tekrar basın. Başarı
   mesajı görmelisiniz.

4. **Aynı PIN iki kişide mi?**
   Sistem bu durumda girişi bilerek reddeder ve *"Bu PIN birden fazla personele
   tanımlı"* der. Garsonlardan birinin PIN'ini değiştirin.

5. **"Veritabanı hatası nedeniyle giriş doğrulanamadı" mesajı**
   PIN yanlış değildir; veritabanı erişiminde sorun vardır → Bölüm 2.

### "Çok fazla hatalı deneme. 10 dakika kilitlendi"

Güvenlik koruması devrede. 4 haneli PIN'in denenerek bulunmasını engeller.
10 dakika bekleyin veya doğru PIN'i verin.

### Garson ekranında masa/menü görünmüyor

Kasada bir değişiklik yapıp kaydedin (örn. bir bölümü düzenleyip kaydedin);
veriler sunucuya gönderilir. Kasa programı açıkken de her değişiklikte
otomatik gönderilir.

### Siparişler kasaya düşmüyor

1. Kasa programı **açık** olmalı — siparişleri sunucudan o çeker.
2. Kasada sunucu adresi girili olmalı (Bölüm 3).
3. Garson telefonunda hata mesajı çıkıyorsa mesajı okuyun; sistem artık
   başarısız gönderimi "iletildi" diye göstermez.

---

## Kurulum Sonrası Güvenlik Kontrol Listesi

- [ ] Yönetici şifrenizi belirlediniz (program hazır şifre ile gelmez)
- [ ] `config.local.php` oluşturuldu, şifre `config.php` içine **yazılmadı**
- [ ] Patron paneli şifresi tanımlandı (`TAHA_BOSS_PASSWORD` ortam değişkeni)
- [ ] Daha önce koda gömülü olan platform API anahtarları (Trendyol / Getir /
      Yemeksepeti) ve MySQL şifresi **değiştirildi** — eski sürümlerde bu
      bilgiler kaynak kodda açıkta duruyordu
- [ ] Sunucu adresi yalnızca **kendi** alan adınız
- [ ] Her garsonun PIN'i benzersiz ve PIN'ler paylaşılmıyor
