# Garson uygulaması (PWA)

Adres: `https://garson.alanadi.com/` — mağaza hesabı gerekmez; tarayıcıdan ana ekrana eklenir. Kasa ile **aynı Wi-Fi'de olmak gerekmez**; telefon kendi mobil interneti veya herhangi bir Wi-Fi ile sunucuya bağlanır.

## İlk kurulum (her telefon için bir kez)

1. Kasada: *Restoran & Donanım Ayarları › Garson Terminalleri & QR › (garson) › 📱 QR / Kod ile Eşle* → ekranda **6 haneli kod** ve **QR** görünür (5 dakika geçerli, tek kullanımlık).
2. Telefonda `https://garson.alanadi.com/` açılır → kod girilir (veya QR okutulur; kamera için HTTPS gerekir ve zaten zorunludur).
3. Telefon eşleşir; **PIN** ekranı gelir.
4. **Ana ekrana ekle:**
   - **Android (Chrome):** menü › *Ana ekrana ekle / Uygulamayı yükle*.
   - **iPhone (Safari):** paylaş › *Ana Ekrana Ekle*.

## Günlük kullanım

1. PIN ile giriş (oturum 12 saat; "kilitle" ile kapatılır).
2. Masa seç → ürün ekle (porsiyon 0,5/1/1,5, not, hazır notlar) → **Siparişi Onayla**.
3. Sonuç **yalnızca sunucu kabul ederse** "kasaya iletildi" olur.
   - **"GÖNDERİLEMEDİ"** çıkarsa: sepet korunur, bağlantıyı kontrol edip aynı düğmeyle **tekrar deneyin**. Tekrar deneme çift sipariş oluşturmaz (aynı işlem kimliği).
   - Üstte kırmızı şerit: *"İnternet yok / Kasa sunucusuna ulaşılamıyor — sipariş gönderilemez"*.
4. Masa taşıma yalnızca **boş** masaya yapılabilir. Hesap iste / garson çağırma kasaya iletilir.

## Neler yapılamaz / bilinmesi gerekenler

- **Telefonda çevrimdışı sipariş kuyruğu yoktur.** İnternet yokken sipariş alınamaz; bilinçli karar (gönderilmiş sanılan ama kaybolan sipariş riskini önlemek için).
- **Anlık bildirim (push) yoktur.** PWA arka planda/uyku modundayken kasa tarafı bilgisini göremez; ekran açıkken 4 sn'de bir yenilenir. iPhone'da arka plan kısıtları daha serttir.
- Kasa kapalıysa sipariş **sunucuya kaydedilir**, kasa açılınca fişe düşer (telefon "iletildi" der; mutfak fişi kasa açılana kadar çıkmaz).
- Başka garsonun cihazı kasadan **sıfırlanırsa** telefon anında yetkisini kaybeder ve PIN ekranına döner.
- Menü/masa sunucudan gelmezse **uydurma menü gösterilmez**; "masa listesi yüklenemedi" uyarısı çıkar.

## Telefon kaybolursa / garson ayrılırsa

Restoran & Donanım Ayarları › Garson Terminalleri & QR › *Eşleşmeyi sıfırla* (telefonun yetkisi anında düşer) ve/veya garsonu pasif yapın (PIN ile de giremez).

## Teknik özet

- Uygulama kabuğu servis çalışanıyla önbelleğe alınır (internet olmasa da sayfa açılır); **API çağrıları asla önbelleğe alınmaz**.
- Tailwind/ikon/yazı tipleri sunucudan yerel dosya olarak gelir (harici CDN yok).
- Başlıklar: `X-Device-Token` (cihaz), `X-Session` (PIN oturumu). Güvenlik ayrıntısı: [security.md](security.md).
