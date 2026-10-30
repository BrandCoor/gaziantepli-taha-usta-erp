# Mimari ve veri akışı

Bu belge **kodda gerçekten olan** mimariyi anlatır.

## Genel görünüm

```
   Garson telefonu (PWA)        Müşteri telefonu (QR menü)      Patron (web)
          │ HTTPS                       │ HTTPS                      │ HTTPS
          ▼                             ▼                            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  cPanel: PHP API (index.php / auth.php / online/*)  +  MySQL/MariaDB  │
  │  Yetki kapısı (security.php): varsayılan REDDET                       │
  └───────────────────────────────▲───────────────────────────────────────┘
                                  │ HTTPS + X-Kasa-Key  (kasa dışarı bağlanır;
                                  │ kasanın internetten erişilebilir olması GEREKMEZ)
  ┌───────────────────────────────┴───────────────────────────────────────┐
  │  KASA BİLGİSAYARI (Windows) — Electron                                │
  │   • React arayüz (localStorage = hızlı önbellek)                      │
  │   • Ana süreç: SQLite kasa.db (ASIL KAYNAK), yedek, günlük, yazdırma  │
  │   • Yerel sunucu 127.0.0.1:4545 (yazıcı + Caller ID; ağdan erişilemez)│
  │   • Kalıcı yazdırma kuyruğu                                           │
  └───────────┬───────────────────────────────┬───────────────────────────┘
              │ USB/spooler                   │ TCP 9100 (yerel ağ)
        Kasa yazıcısı                  Mutfak yazıcıları (Fırın/Ocak…)
```

## Tek doğruluk kaynağı kuralı

| Veri | Asıl kaynak | Kopya |
|---|---|---|
| Masa/adisyon, ödeme, Z, cari, ürün, personel (kasa verisi) | **Kasa `kasa.db` (SQLite)** | Arayüzde localStorage önbelleği; bulutta MySQL aynası (`push_kasa_state`) |
| Garson/QR'dan gelen **siparişler (kuyruk)** | **Bulut MySQL `siparisler`** — kasa kalıcı kaydedip onaylayana kadar | Kasada işlenince kasa verisine katılır |
| Garson cihaz eşleşmeleri, PIN oturumları | Bulut MySQL (`cihazlar`, `personeller`) | — |

Çelişki kuralları (bulut → kasa çekmede, `src/services/syncMerge.ts`):
- **Geçmiş kayıtlar** (Z, arşiv, cari/toptancı hareketleri, giderler): ID bazlı **birleşim**; yerel kayıt asla ezilmez.
- **Ana veri** (ürün, kategori, personel, yazıcı, bölüm): bulut yalnızca **yerel liste boşsa** uygulanır (yeni PC'ye geri yükleme).
- **Açık masalar**: yerelde hiç masa yoksa bulutan alınır; aksi halde kasa kazanır.
- Kasa buluta gönderirken **silme yapmaz** (gizli "gönderilmeyeni sil" kaldırıldı); silme yalnızca açık `delete_item` ile.

## Sipariş akışı (garson → kasa → mutfak)

1. Garson sepeti onaylar. Telefon her sepet için bir **`clientOrderId`** üretir ve `send_order` çağırır (cihaz anahtarı + PIN oturumu başlıkta).
2. Sunucu: kimlik doğrular → **fiyatları kendi veritabanından yeniden hesaplar** (istemci fiyatı yok sayılır) → tek **işlemde** `siparisler` kaydını ve masa durumunu yazar. Aynı `clientOrderId` ikinci kez gelirse yeni kayıt oluşmaz (`duplicate:true`).
3. Sunucu **kalıcı kayıt yapmadan başarı dönmez.** Telefon, yalnızca `success:true` alırsa "iletildi" der; aksi halde hata gösterir ve **sepeti korur**; aynı kimlikle tekrar dener.
4. Kasa 1,5 sn'de bir `pull_pending_orders` çağırır. Sipariş **tüketilmez**. Kasa adisyona yazar, işlenmiş kimliği **kalıcı** saklar (çift işleme yok), mutfak fişini **yazdırma kuyruğuna** koyar, sonra `ack_orders` ile bulutta onaylar. Onay gitmezse sipariş tekrar gelir; kalıcı kimlik listesi çift işlemeyi önler.
5. Sipariş **kaydı** ile fişin **fiziksel basımı** ayrı olaylardır: yazıcı kapalıysa sipariş kaybolmaz, fiş kuyrukta bekler (otomatik yeniden deneme, kasada görünür uyarı).

## İnternet kesintisi / kasa kapalı

| Durum | Davranış |
|---|---|
| İnternet yok, kasa açık | Kasa **tam çalışır** (POS, ödeme, yerel yazdırma, Z, yedek). Garson telefonları sunucuya ulaşamaz → "bağlantı yok / sipariş gönderilemez" gösterir (sahte başarı yok). İnternet gelince kasa durumunu gönderir. |
| İnternet var, kasa kapalı | Garson siparişi **sunucuya kaydedilir** ve kasa açılınca çekilir; telefon "iletildi" der çünkü sunucu kabul etti (kasa fişi sonra basar). |
| Telefonda internet yok | Gönderim başarısız → sepet korunur, tekrar dene. Telefonda çevrimdışı sipariş kuyruğu **yoktur** (bilinçli: onaylanmamış siparişin "gitmiş" sanılması riskini önler). |

## Kasa uygulaması içi katmanlar

- **Güvenli Electron:** `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`; sayfa yalnızca `preload.ts` içindeki **izin listeli** IPC kanallarını kullanır; IPC çağrıları gönderen sayfa doğrulanır.
- **Kalıcı depo:** `durableStorage.ts` (arayüz) ↔ `kvStore.ts` (ana süreç, SQLite). Ayrıntı: [database.md](database.md).
- **Yazdırma:** `printerService.ts` → `printQueue.ts` (kalıcı kuyruk) → ESC/POS (TCP 9100 veya Windows spooler). Tarayıcı yazdırma yalnızca kullanıcı açıkça seçerse.
- **Yedek/günlük:** `backupStore.ts`, `logger.ts`.

## Kod haritası

| Yol | İçerik |
|---|---|
| `electron/` | Ana süreç, preload, yerel sunucu, yazıcı sürücüsü, SQLite, yedek, günlük |
| `src/services/` | İş mantığı (`restaurantDataService`, `dataService`, `printerService`, `fullBackup*`, `durableStorage`…) |
| `src/modules/` | Ekranlar (POS, ayarlar, raporlar, cari…) |
| `cpanel-yuklenecekler/api/` | PHP API (`index.php`, `auth.php`, `security.php`, `config.php`, `online/`) |
| `cpanel-yuklenecekler/{garson,menu,patron}` | Web arayüzleri; `assets/` derlenmiş CSS/yazı tipleri (CDN yok) |
| `tests/`, `tools/dev/` | Birim/entegrasyon testleri; uçtan uca ve geliştirme araçları |
