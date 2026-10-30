# Platform API Notları (Trendyol Go Yemek / Yemeksepeti)

GetirYemek ayrı entegre edilmez: Getir siparişleri Trendyol Go Yemek paketlerinde `appName=Galaxy` ile gelir.

## Trendyol Go Yemek (resmî: developers.tgoapps.com)
- Kimlik: Satıcı ID, API Key, Secret Key, entegrasyon e-postası. Basic auth `apiKey:secret`.
- Zorunlu başlıklar: `User-Agent: {satıcıId} - SelfIntegration`, `x-agentname`, `x-executor-user` (e-posta).
- Uçlar: paketler `GET`, `picked`, `invoiced`, `manual-shipped`, `manual-delivered`, `unsupplied` (iptal, neden 621–627), mağaza `GET` / durum `PUT`.
- Sınır: 10 sn'de 50 istek. Webhook gerekmez; sunucu en fazla 20 sn'de bir sorgular.
- `deliveryType`: STORE (kendi kurye) / GO (Trendyol kuryesi).

## Yemeksepeti Partner API v2 (resmî: developer.yemeksepeti.com)
- OAuth2 client_credentials (client_id / client_secret), Chain ID + Vendor ID.
- Sipariş sorgulama, sipariş durumu (READY_FOR_PICKUP / DISPATCHED / CANCELLED), mağaza durumu (OPEN / CLOSED_TODAY / CLOSED_UNTIL).
- İsteğe bağlı webhook: statik token. Müşteri bilgileri maskelidir. Ayrı "kabul" ve "teslim edildi" uçları yoktur.

## Doğrulanamayanlar
Gerçek hesap olmadan denenmedi: Yemeksepeti liste kapsayıcı alanı ve iptal nedeni değerleri, Trendyol ödeme tipi sabitleri. Menufay'ın Yemeksepeti kullanıcı adı/şifre yöntemi resmî API değildir ve kullanılmaz.
