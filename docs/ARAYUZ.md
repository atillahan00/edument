# Arayüz görünümleri

Sağ üstteki **Görünüm** alanı dört tasarım arasında geçiş yapar:

- **Çok sade** (varsayılan): üstten gruplanmış gezinme; açık işlem listesi, yan bildirim alanı ve iki sütunlu kompakt ayarlar.
- **Sade**: yan gezinme dizini; tek sütunlu çalışma bölümleri ve ayrı ayar sayfası düzeni.
- **Keskin çizgiler**: siyah üst başlık, turkuaz numaralı gezinme, büyük tipografi ve sert bölünmüş çalışma alanları.
- **Cam etkisi**: bağımsız gezinme yüzeyi ve yarı saydam belge alanı; kayan dizin ve ayrılmış ayar sütunu.

Tercih bu tarayıcıda saklanır; sayfa değişiminde ve yeniden açılışta korunur. Görünüm değiştirmek sayfayı yenilemez, form değerlerini veya seçili dosyaları temizlemez. Tarayıcı depolamayı engellese bile geçiş çalışır; bu durumda tercih kalıcı olmayabilir.

## Yeniden düzenlenen yapı

Giriş ekranında pazarlama paneli, slogan ve dekoratif görseller yoktur; yalnızca hesap işlemleri bulunur. Yönetim merkezi kart kataloğu yerine açıklamalı işlem satırları kullanır. Genel içerik bölümlerinde başlık ve işlem alanı ayrılır. Öğrenci ekranında karşılama bandı yerine kayıt araç çubuğu ve kompakt sayısal özet bulunur. Tüm görünümler aynı kontrol ağacını korur; yerleşim geçişleri form bileşenlerini yeniden oluşturmaz.

## Palet

| Renk      | Kullanım                          |
| --------- | --------------------------------- |
| `#EFEFEF` | Nötr zemin                        |
| `#3454D1` | Ana işlemler, bağlantılar, odak   |
| `#34D1BF` | Olumlu durumlar, grafikler, vurgu |
| `#070707` | Metin ve çerçeveler               |
| `#D1345B` | Hata ve olumsuz durumlar          |

Okunabilirlik için durum etiketlerinde bu renklerin açık zeminleri ve koyu metin tonları kullanılır. Renkler anlam belirten metinlerin yerine geçmez.

## Uygulama

- `apps/web/src/lib/design.ts`: görünüm adları, saklama anahtarı ve ilk çizim öncesi tercih yükleme.
- `apps/web/src/components/appearance-switcher.tsx`: klavyeyle kullanılabilen, sayfayı yenilemeyen seçim.
- `apps/web/src/app/globals.css`: ortak düzen, tasarım değişkenleri ve mobil görünümler.

Görsel düzenleme; rol izinlerini, API çağrılarını, kayıt yapısını, form doğrulamasını ve veri işlemlerini değiştirmez. Hareket azaltma tercihi desteklenir; mobil menü Escape ile ve dış alana tıklanarak kapatılabilir.

## Doğrulama

`tests/e2e/design.spec.ts` tema kalıcılığını, form değerlerini, dosya seçimini, mobil taşmaları ve menüleri denetler. Yönetici testi gerçek yerel oturum kullanır; ayarları kaydetmez. Öğrenci, mentor ve doğrulayıcı görünüm testleri yalnızca tarayıcıdaki örnek yanıtları kullanır; sunucuya kayıt eklemez.

Kurulu Chrome ile çalıştırmak için PowerShell'de:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
node node_modules/@playwright/test/cli.js test tests/e2e/app.spec.ts tests/e2e/design.spec.ts
```

`PLAYWRIGHT_CHANNEL` verilmezse mevcut Playwright Chromium ayarı kullanılır.
