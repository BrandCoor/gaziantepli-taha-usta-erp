# 🍽️ Gaziantepli Taha Usta - Restoran Otomasyonu, POS & ERP Sistemi

Gaziantepli Taha Usta Kebap & Lahmacun Restoranı için özel olarak geliştirilmiş; masa adisyon yönetimi, parçalı ödeme / Alman usulü tahsilat, akıllı mutfak yazıcı yönlendirmesi (Fırın & Ocak ESC/POS), mobil garson uygulaması (PWA), sabit hat Caller ID ve Toptancı/Gider ERP yönetimini tek çatı altında toplayan hibrit masaüstü otomasyonudur.

---

## 🏛️ 1. Sistem Mimarisi & Donanım Katmanı

                           ┌──────────────────────────────────────────────┐
                           │        cPanel Bulut Katmanı (Hosting)        │
                           │  • garson.rymedya.com.tr (Mobil Garson PWA)  │
                           │  • api.rymedya.com.tr (Senkronizasyon/Bridge)│
                           │  • patron.rymedya.com.tr (Uzaktan Canlı Ciro)│
                           └──────────────────────┬───────────────────────┘
                                                  │ (Çift Yönlü Canlı Senkron)
                                                  ▼
                           ┌──────────────────────────────────────────────┐
                           │          KASA TERMİNALİ (Electron + React)   │
                           │  • Frameless Tam Ekran POS & Kasa Terminali  │
                           │  • Dahili Express & WebSocket Sunucusu (:4545)│
                           │  • Sabit Hat Caller ID Entegrasyonu          │
                           │  • Akıllı ESC/POS Fiş Yönlendirme Motoru     │
                           └───────┬──────────────┬──────────────┬────────┘
                                   │              │              │
                                   ▼              ▼              ▼
                           ┌──────────────┐┌──────────────┐┌──────────────┐
                           │ KASA YAZICI  ││ FIRIN YAZICI ││ OCAK YAZICI  │
                           │  (USB Port)  ││ (Ethernet IP)││ (Ethernet IP)│
                           │ Adisyon & Z  ││ 192.168.1.201││ 192.168.1.202│
                           └──────────────┘└──────────────┘└──────────────┘


---

## 🚀 2. Temel Modüller ve İşleyiş Mantığı

### 🍽️ A. Restoran Masaları & POS Yönetimi (`src/modules/pos/PosView.tsx`)
1. **Masa Düzeni:** Salon, Bahçe ve Paket Servis masaları canlı renklerle izlenir (Boş: Yeşil, Dolu: Kırmızı, Hesap İstendi: Altın Sarısı, Paket: Turuncu).
2. **Kontrollü Sipariş & Adisyon:** Masadaki ürünler rastgele `+`/`-` ile değiştirilemez. İlave ürünler sağdaki menüden eklenir (`status: 'PENDING'`); iptaller ise adet ve sebep seçilerek kontrollü şekilde mutfağa iptal fişi kesilerek yapılır.
3. **Akıllı İlave (Delta) Yazdırma:** Masaya ilave ürün girildiğinde yazıcılar eski yemekleri **asla tekrar basmaz**; yalnızca yeni eklenen ürünler için `*** İLAVE SİPARİŞ ***` fişi kesilir.
4. **Parçalı Tahsilat & Alman Usulü:**
   * Çoklu ürün seçimi yapılarak seçilenlerin tutarı otomatik toplanır.
   * `1/2`, `1/3`, `1/4`, `1/5` butonlarıyla kalan hesap eşit bölünür.
   * Kalan borç üzerinden akıllı `%` (yüzdelik indirim) hesaplanır.
   * **Cari (Veresiye):** Müşteri seçildiğinde onay istenir ve hesap kapandığında tutar otomatik olarak müşterinin cari kartına borç işlenir.
   * **Kalan Tutar Kuralı:** Masanın kalan borcu `0.00 ₺` olmadan masa kapatılamaz.

### 📱 B. Garson Mobil Web Uygulaması (`garson.rymedya.com.tr`)
* **Tek Seferlik QR Eşleme:** Garson kasadaki QR kodu ilk gün telefonuna okutur; cihazın benzersiz kimliği (MAC/UUID) kasaya kilitlenir. Bir daha asla QR okutmaz.
* **Hızlı PIN Girişi:** Garson 4 haneli şifresini tuşlayarak anında masalara ulaşır.
* **Doğrudan Menü Erişimi:** Masayı açtığında ilk olarak menü gelir. Ürünlere dokunarak sepete atar.
* **Hızlı Restoran Notları:** Ürünlerin altına tek tıkla `[🔥 Önden Gelsin]`, `[🍲 Çorba Arkası]`, `[🌶️ Acılı]`, `[Lavaş Çift]`, `[Az Pişmiş]` hazır etiketleri eklenir.
* **Masa Taşıma & Fiş İsteme:** Boş masayı görsel olarak seçip masayı taşır; `[🖨️ Fiş İste]` butonuyla kasa yazıcısından hesap fişi çıkartır.

### 📞 C. Sabit Hat Caller ID & Paket Servis (`src/modules/delivery/DeliveryView.tsx`)
* Sabit hat çaldığında sistemde kayıtlı müşterinin adı, telefonu ve teslimat adresi anında ekranda belirir.
* Kayıtlı değilse tek tıkla rehbere eklenir.
* **"Sipariş Ver (Paket Aç)"** butonuna basıldığında boş paket masasına geçilir, menü açılır; sipariş mutfağa gittiğinde Fırın/Ocak fişlerinin ve kurye adres fişinin üzerinde müşterinin **Adı Soyadı, Telefonu ve Açık Adresi** basılır.

### 🏢 D. Giderler & Toptancılar ERP Modülü (`src/modules/expenses/ExpenseListView.tsx`)
* **İşletme Giderleri:** Kira, elektrik, su, personel giderleri kaydı ve filtreleme.
* **Toptancı / Tedarikçi Yönetimi:** Et, sebze, un toptancıları yönetimi ve bakiye takibi.
* **Alış Faturası Girişi:** Toptancıya fatura girildiğinde toptancının borcu artar (+). Faturada ödeme yöntemi sorulmaz (`— Açık Hesap`).
* **Toptancıya Ödeme Yapma:** Toptancıya yapılan Nakit, Havale veya Kart ödemeleri borçtan düşülür (-).
* **Cari Ekstre Düzenleme:** Toptancı ekstresindeki her fatura ve ödeme düzenlenebilir veya silinebilir; toptancı borç bakiyesi otomatik olarak yeniden eşitlenir.
* **Bakiye Koruma Kilidi:** Bakiyesi sıfır olmayan hiçbir Müşteri, Toptancı veya Personel sistemden silinemez.

### 🏁 E. Gün Sonu Z Raporu & Mali Denetim (`src/modules/reports/ReportsView.tsx`)
* **Anlık X Raporu:** Gün içi masa satışları, nakit/kart dağılımı, çıkan işletme giderleri, toptancı ödemeleri ve **Kasada Kalan Net Nakit** mutabakatı.
* **Tek Tıkla Z Raporu Kapanışı:** Nakit sayımı sormadan doğrudan günü kapatır ve Afanda 892E kasa yazıcısından resmi Z fişi basar.
* **Detaylı Filtreleme:** Tarih ve işlem türü bazında tüm restoran defterini filtreleme ve Excel (.xlsx) çıktısı alma.

---

## 🖨️ 3. Termal Yazıcı Standartları (Afanda 892E & ESC/POS)

* **Bağlantı Türleri:** USB (Windows Spooler) & Ethernet TCP Port 9100 RAW Socket.
* **Türkçe Karakter Normalizasyonu:** `ğ, ş, ı, ç, ö, ü` harfleri bozulmadan basılır.
* **Akıllı Mutfak Ayrımı:**
  * *Lahmacun & Pide* $\rightarrow$ **Fırın Yazıcısı (192.168.1.201:9100)**
  * *Kebaplar & Izgaralar* $\rightarrow$ **Kebap Ocağı Yazıcısı (192.168.1.202:9100)**
  * *Hesap Fişi, Z Raporu & Kurye Adres Fişi* $\rightarrow$ **Kasa Yazıcısı (USB)**

---

## 🎨 4. Tasarım & Renk Standartları (Design Tokens)

* **Ana Arka Plan:** `#141416`
* **Kartlar & Paneller:** `#1C1C20`
* **Kenarlıklar (Borders):** `#2C2C34`
* **Metin Renkleri:** `#FAF7F2` (Ana), `#8E8E98` (İkincil)
* **Gaziantep Altın Vurgu:** `#F5C877` / `from-[#F5C877] to-[#D4A351]`
* **Pozitif / Nakit / Başarılı:** `#10b981` (Emerald)
* **Negatif / Borç / İptal:** `#f43f5e` (Rose)

---

## 🛠️ 5. Geliştirici & Başlatma Komutları

```powershell
# Geliştirme Ortamını Başlatma
npm run dev

# Derleme (Production Build)
npm run build

# Masaüstü Kurulum Paketi (Electron Setup)
npm run electron:build

