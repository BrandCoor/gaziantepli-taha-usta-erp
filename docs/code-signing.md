# Kod imzalama sertifikası nedir, gerekli mi?

## Kısaca
Windows'ta bir program indirip çalıştırdığınızda mavi bir uyarı görürseniz ("Windows bilgisayarınızı korudu — Yayımcı: Bilinmeyen"), bunun nedeni programın **imzasız** olmasıdır. **Kod imzalama sertifikası**, yazılımı yayımlayan kişi/şirketin kimliğini doğrulayan, yıllık ücretli bir "dijital kimlik kartı"dır; programın üstüne dijital bir mühür basar. Mühürlü programın sonradan değiştirilip değiştirilmediği de anlaşılır.

## Sizin durumunuzda ne işe yarar / yaramaz?
| | İmzasız (şu anki) | İmzalı |
|---|---|---|
| Kasa kurulumu ve **otomatik güncelleme** çalışır mı | **Evet** | Evet |
| Windows uyarısı | İlk kurulumda "Yine de çalıştır" demek gerekir | Uyarı yok ya da çok azalır |
| Güncelleme dosyasının bozulmadığı kontrolü | **Var** (SHA-512 özet + HTTPS) | Var + Windows imzası da kontrol edilir |
| Hosting hesabı ele geçirilirse | Saldırgan hem dosyayı hem özeti değiştirebilir | İmza anahtarı sizde olduğu için sahte güncelleme **imzasız kalır ve reddedilir** |

**Öneri:** Tek restoran ve tek kasa için **şu an zorunlu değil**. Güncellemeler imzasız da güvenle çalışır; ana koruma **hosting hesabınızın güvenliğidir** (cPanel için güçlü parola + iki adımlı doğrulama, FTP parolasını paylaşmamak). İleride birden çok şube/kasaya geçerseniz veya Windows uyarısı sizi rahatsız ederse imzalamayı ekleriz.

## Nasıl alınır? (isterseniz)
1. Bir **kod imzalama sertifikası** satın alınır. Sağlayıcılar: Sectigo, DigiCert, SSL.com ve bunların Türkiye'deki yetkili satıcıları. Yıllık yaklaşık birkaç yüz dolar mertebesindedir (fiyat sağlayıcıya göre değişir; güncel fiyatı sağlayıcıdan öğrenin).
2. Sağlayıcı **kimlik doğrulaması** ister: şirket belgeleri (vergi levhası, imza sirküleri), yetkilinin kimliği, telefonla doğrulama. 1-5 iş günü sürebilir.
3. Sertifika türleri:
   - **OV (kuruluş doğrulamalı):** daha ucuz; Windows SmartScreen uyarısı zamanla (yeterli sayıda kurulum olunca) kalkar.
   - **EV (genişletilmiş doğrulama):** daha pahalı; uyarı hemen kalkar. Son yıllarda çoğu sağlayıcı anahtarı **USB belleğe/donanım anahtarına** koyar (bilgisayarınıza takılı olması gerekir).
4. Alternatif: Microsoft'un bulut imzalama hizmeti ("Trusted Signing"). Şirket doğrulaması gerekir; bulundukları ülkeler sınırlıdır. Türkiye'deki geçerliliğini almadan önce Microsoft sayfasından kontrol edin.
5. Elinize geçince (**.pfx dosyası + parolası**) bana göndermeyin — **kendi bilgisayarınızda** şu iki ortam değişkenini ayarlayıp `npm run electron:build` çalıştırırsınız: `CSC_LINK` (dosya yolu), `CSC_KEY_PASSWORD` (parola). Bu bilgiler **asla Git'e/sohbete yazılmaz**. Ben de `package.json › build.win` içine `publisherName` (sertifikadaki ad) ekleyip yayını doğrulatırım.

## Ne yapmayın
- "Kendi kendine imzalı (self-signed)" sertifika üretmeyin: Windows'ta hiçbir güven sağlamaz, uyarı kalkmaz.
- Sertifikayı/parolayı depoya, e-postaya veya sohbete koymayın.
