# Gaziantepli Taha Usta ERP & POS - Müşteri Bilgisayarı Kurulum Kılavuzu

Bu belge, projeyi GitHub'a aktarma, müşteri bilgisayarına kurma ve bulut veritabanı seçenekleri hakkında eksiksiz rehberdir.

---

## 1. Projeyi GitHub'a Yükleme ve İndirme

Google AI Studio üzerinden projeyi GitHub hesabınıza yüklemek için:

1. **AI Studio Ekranının Sağ Üst Köşesi**:
   - Sağ üstteki **"Share / Paylaş"** veya **"Settings / Dışa Aktar"** menüsüne tıklayın.
   - **"Export to GitHub"** seçeneğini seçin.
   - GitHub hesabınızı bağlayarak depoyu (repository) tek tıkla oluşturup kodları yükleyebilirsiniz.
2. **ZIP Olarak İndirmek İsterseniz**:
   - Yine aynı menüden **"Download ZIP / Projeyi İndir"** butonuna basarak tüm projeyi bilgisayarınıza tek parça halinde indirebilirsiniz.

---

## 2. Müşteri Bilgisayarına Kurulum (2 Farklı Yöntem)

### Yöntem A: Hızlı Kurulum (Tavsiye Edilen - 2 Dakika)

1. Müşterinizin Windows dokunmatik POS bilgisayarına **Node.js**'i kurun:
   - [https://nodejs.org](https://nodejs.org) adresinden **LTS (Uzun Vadeli Kararlı)** sürümünü indirip ileri-ileri diyerek kurun.
2. Proje klasöründeki **`kurulum_ve_setup.bat`** dosyasına sağ tıklayıp çalıştırın.
   - Gerekli kütüphaneleri otomatik yükler.
   - Sistemi derler.
   - Müşterinin Windows masaüstüne **"Gaziantepli Taha Usta POS"** kısayolunu otomatik oluşturur.
3. Müşteri artık masaüstündeki bu simgeye çift tıklayarak sistemi tam ekran dokunmatik POS modunda kullanabilir!

---

### Yöntem B: Bağımsız Masaüstü Kurulum Dosyası (.exe Setup) Oluşturma

Projeye **Electron Builder** altyapısı entegre edilmiştir. Bilgisayarda terminal/komut satırını açıp şu komutu çalıştırabilirsiniz:

```bash
npm run electron:build
```

Bu komut tamamlandığında `release/` klasörü içinde **`Gaziantepli Taha Usta Setup 1.0.0.exe`** kurulum dosyası oluşur. Bu `.exe` dosyasını flash belleğe atıp müşterinin bilgisayarına tıpkı Word, Excel gibi çift tıklayarak kurabilirsiniz.

---

## 3. Demo Yazıcıların Kaldırılması & Gerçek Yazıcı Tanımlama

- Daha önce sistemde görünen tüm demo yazıcılar (`pr-kasa`, `pr-firin`, `pr-ocak`, `pr-paket` vb.) tamamen kaldırıldı ve hafızadan temizlendi.
- Artık **Yazıcılar** sekmesi boştur ve sildiğinizde kesinlikle geri gelmez.
- Dükkandaki gerçek yazıcıyı bağlamak için:
  - **USB Yazıcı:** USB kablosunu kasaya takıp "Yeni Yazıcı Ekle" -> "USB" seçip listeden seçin.
  - **Ağ/Ethernet Yazıcısı:** Yazıcının IP adresini (Örn: `192.168.1.200`) ve portunu (`9100`) yazıp kaydedin.

---

## 4. Veritabanını Bulutta Saklama Seçenekleri

**Evet, veritabanını bulutta saklayabilirsiniz!** Bunun için 2 harika seçeneğiniz bulunmaktadır:

### Seçenek 1: Google Cloud Firebase (Firestore)
- Masalar, siparişler, zayi/iptal kayıtları, adisyonlar ve menü anlık olarak Google Cloud Firestore'a kaydedilir.
- İnternet kesilse dahi çevrimdışı (offline) çalışır, internet gelince bulutla otomatik eşitlenir.
- Garsonların telefonları, tabletler ve ana kasa aynı anda sıfır gecikmeyle senkronize olur.
- Yedek alma derdini ortadan kaldırır.

### Seçenek 2: Kendi cPanel / MySQL Sunucunuz
- Proje kök dizininde yer alan **`cpanel-yuklenecekler`** klasöründeki dosyaları kendi hosting/cPanel sunucunuza yükleyerek verilerinizi kendi MySQL veritabanınızda tutabilirsiniz.
- Zaten sistemde `https://api.rymedya.com.tr/` API köprüsü hazır tanımlıdır.
