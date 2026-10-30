# Sürümleme ve uyumluluk

## Bileşenler ve sürüm kaynakları
| Bileşen | Sürüm nerede | Değiştirme |
|---|---|---|
| Kasa (Windows) | `package.json › version` (derlemede `__APP_VERSION__` olarak gömülür; `latest.yml`) | `node tools/bump-version.cjs X.Y.Z` |
| Garson PWA | `garson/index.html › GARSON_VERSION`, `garson/sw.js › VERSION`, `garson/version.json` (üçü aynı) | aynı komut |
| Sunucu (API) | `api/version.php › GTU_API_VERSION` | `bump-version.cjs X.Y.Z --api X.Y.Z` |
| Veritabanı şeması | `api/config.php › gtuSchemaMigrations()` en yüksek numara (`ayarlar.schema_version`) | yeni numaralı göç ekleyerek |
| Kasa yerel veri şeması | `electron/main.ts › DATA_SCHEMA_VERSION` (`kasa.db › meta.schema_version`) | göç eklenince artırılır |
| Güncelleme manifesti | `latest.yml` (kasa), `update-policy.json` (notlar/kritik/`minSupported`) | `tools/update-tools.cjs` |

Sürüm biçimi `MAJOR.MINOR.PATCH`. **PATCH:** hata düzeltme · **MINOR:** geriye uyumlu özellik · **MAJOR:** uyumsuz değişiklik (sunucu `MIN_*` yükseltilir).

## Uyumluluk matrisi
| Kasa | Garson | Sunucu | Not |
|---|---|---|---|
| 1.0.x | 1.0.x | 1.0.x–1.1.x | Başlıksız eski istemci sunucuda kabul edilir |
| 1.1.x | 1.1.x | ≥ 1.0.0 | Yeni istemci eski sunucuyla çalışır ("sürüm" ucu yoksa uyarı gösterir, engellemez) |
| < `MIN_KASA_VERSION` / `MIN_GARSON_VERSION` | — | herhangi | Sunucu **426** döner; işlem yapılmaz |

Kurallar:
- **Sunucu önce güncellenir**, istemciler sonra. Sunucu her zaman en az bir önceki istemci sürümünü destekler (`MIN_*` bu yüzden kademeli yükseltilir).
- Yeni istemci → eski sunucu: istemci `GET ?action=version` ile sunucu sürümüne bakar; `MIN_API_VERSION`'dan eskiyse **uyarı** gösterir (`src/services/appVersion.ts`).
- Eski istemci → yeni sunucu: istemci `X-Client-Type` + `X-Client-Version` başlıklarını gönderir; sunucu `MIN_*`'den eskiyse **426 (CLIENT_TOO_OLD)** döner ve **hiçbir kayıt yazmaz**. Kasa kırmızı şerit, garson "Güncelleyin" şeridi gösterir; sepet/adisyon yerinde kalır (**sessiz veri kaybı yok**).
- `MIN_*` acil durumda `config.local.php` ile (`MIN_KASA_VERSION`, `MIN_GARSON_VERSION`) kod değişmeden yükseltilebilir (ör. güvenlik açığı olan eski sürümü kapatmak için).
- `version`, `health`, webhook ve QR menü uçları sürüm kapısından **muaftır** (eski istemci de uyarıyı görebilsin; platform siparişleri kesilmesin).

## Veritabanı şeması ve uygulama sürümü ayrı konulardır
- Sunucu şeması **yalnızca ekleme** yapar (sütun/tablo); eski kod yeni şemayla çalışır → sunucu kodunu geri almak güvenlidir.
- Kasa yerel verisi daha yeni şemayla yazıldıysa eski kasa **açılmaz** (veri korunur).
- Göç kuralları: numaralı · tekrar çalışsa zararsız · öncesinde SQL yedeği · hata olursa durur/sürümü artırmaz · veri silmez.
