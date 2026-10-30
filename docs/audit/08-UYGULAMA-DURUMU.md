# 08 — Denetim bulgularının güncel durumu

İlk denetim (01–07) kodda okunan bulguları listelemişti. Bu belge, **uygulama sonrası** durumu gerçek test kanıtıyla eşler. Ayrıntılar: [../testing.md](../testing.md), [../security.md](../security.md).

Durum: ✅ giderildi ve test edildi · 🟡 giderildi, **gerçek ortamda** doğrulanmalı · ⚠️ kısmen · ⬜ yapılmadı

| Kod | Bulgu | Durum | Nasıl / kanıt |
|---|---|---|---|
| B-01 | Asıl depo localStorage | ✅ | Ana süreçte SQLite (WAL/FULL); `kvStore.test` (SIGKILL), `e2e-durable` 14/14. **Not:** veri modeli hâlâ anahtar-değer (bkz. sınırlamalar) |
| B-02 | API'de kimlik doğrulama yok | ✅ | `security.php` varsayılan-reddet; `apiSecurity.integration` |
| B-03 | Repoda gizli bilgiler | ⚠️ | Koddan çıkarıldı + taranıp doğrulandı. **Git geçmişinde duruyor → sizin iptal etmeniz gerekir** (DB parolası, platform anahtarları, NVIDIA anahtarı) |
| B-04 | Eşleştirme atlatma | ✅ | Sunucu kodu, tek kullanımlık, süreli; testler |
| B-05 | Yazıcı hatası başarı sayılıyor | ✅ mantık / 🟡 donanım | Kalıcı kuyruk (`printQueue.test`). Gerçek yazıcıda doğrulanmadı |
| B-06 | Garson hatayı yutuyor, idempotency yok | ✅ | `clientOrderId`, honest hata; `e2e-garson` 20/20 |
| B-07 | Sipariş okununca tüketiliyor | ✅ | `ack_orders`; `orderApi.integration` |
| B-08 | Bulut yereli eziyor / push siliyor | ✅ | `syncMerge`; toplu silme kaldırıldı |
| B-09 | Masa taşıma hedefi eziyor | ✅ | Birleştirme + sunucuda 409; `tableOps.test` |
| B-10 | Yedek yalnızca ayar | ✅ | Tam yedek + geri yükleme; `fullBackup*.test`, panel |
| B-11 | Z raporu hataları | ⚠️ | İş günü, çift sayım, iptal kaydı, yuvarlama ✅. **KDV tek oran %10** ve açılış tutarı varsayımı işletme onayı bekler |
| B-12 | Electron/yerel sunucu güvenliği | ✅ | Gerçek Electron'da doğrulandı (`typeof require === undefined`, izin listesi, Host/Origin/IP) |
| B-13 | Yerel kullanıcılar/yetkiler | ✅ | PBKDF2, ilk kurulum, kilit, yetki matrisi; `e2e-kasa-auth` 13/13, `permissions.test` |
| B-14 | Patron girişi | ✅ | Hash, hız sınırı, imzalı token |
| B-15 | Sunucu fiyatı istemciden alıyor | ✅ | Sunucuda yeniden hesap; test |
| B-16 | Webhook imzası isteğe bağlı | ✅ mantık / 🟡 canlı | Anahtarsız reddedilir; platformların gerçek imza biçimi canlı doğrulanmalı |
| B-17 | Sipariş numarası çakışması | ✅ | Günlük sayaç; `orderNumber.test` |
| B-18 | Ödeme/cari atomik değil | ⚠️ | Sıra düzeltildi, çift tıklama kilidi, doğrulama; tam atomiklik ilişkisel göçle |
| B-19 | Kayan nokta | ✅ | Kuruş yuvarlama, test |
| B-20 | localStorage kotası | ✅ | Kotasız bellek tabanlı depo; 12 MB e2e |
| B-21 | PWA uygunluğu | ✅ | Manifest + SW + yerel varlık; `pwa-check` 12/12. 🟡 gerçek iPhone/Android |
| B-22 | Geliştirici alan adları | ✅ | Kaldırıldı (taranıp doğrulandı) |
| B-23 | Çoklu şema kaynakları | ✅ | Prisma/SQL dosyaları kaldırıldı; tek kaynak PHP `ensureDatabaseTables` + sürümlü göç |
| B-24 | Düşük öncelikli | ⚠️ | `/api/health` ✅, araç dosyaları ✅, test+lint ✅. **Fişte Türkçe karakter ASCII'ye çevriliyor** (CP857 fiziksel testle açılmalı) |

| Şüphe | Sonuç |
|---|---|
| S-01 çift tıkla cari borç | ✅ Giderildi (kilit + sıra); `payment.test` |
| S-02 açılışta çift kalem | ✅ Bulut masaları yalnız yerel boşsa uygulanır |
| S-03 `send_order` kayıp güncelleme | ✅ `FOR UPDATE` işlemi |
| S-04 kaldırmada veri silinir mi | ✅ Silinmiyor (`e2e-installer`) |
| S-05 `WaiterView.tsx` | ✅ Kasa-içi garson modu kapatıldı |
| S-06 JSON dosyası web'den okunur mu | ✅ JSON modu kaldırıldı |
| S-07 Afanda RAW spooler | 🟡 Donanım gerekir |

## Yeni bulgular (uygulama sırasında bulundu ve giderildi)
Sabit `1453` yönetici PIN'i arka kapısı · `opencode.json` içinde API anahtarı · `DEFAULT_FOOD_PLATFORMS` içinde ikinci gömülü platform anahtarı seti · sunucunun boş veritabanında demo salon/masa üretmesi (GET ile yazma) · demo garson/parola tohumları (SQL) · CORS ön kontrolünün yeni kimlik başlıklarını reddetmesi · derlenmiş Electron'un `__dirname` hatasıyla hiç pencere açmaması · bulut geri yüklemesinin cari hareketleri yanlış anahtara yazması · `reset_device_pairing`'in olmayan tabloya yazması · eşleştirme süresinde saat dilimi hatası · kasa-içi sahte "Cihaz Mühürlendi" · sunucuya ulaşılamasa da başarı gösteren cihaz sıfırlama.
