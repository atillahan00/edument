# EduMent geliştirme ve test rehberi

[Belge dizini](README.md) · [Katkı rehberi](../CONTRIBUTING.md)

Önce [kurulum rehberini](KURULUM.md) tamamlayın. Komutları depo kökünden çalıştırın.

## Test ve üretim derlemesi

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm matcher:test
pnpm build
pnpm test:integration
pnpm test:e2e
pnpm integrity:check
```

Tarayıcı testinden önce Chromium yükleyin: `node node_modules/@playwright/test/cli.js install chromium`. API, web, veritabanı, MinIO, matcher ve dağıtılmış Besu sözleşmesi bütünleşme testleri için çalışıyor olmalıdır. Bütünleşme testleri `example.invalid` adresli açıkça sentetik geçici kullanıcılar üretir, ardından uygulama verilerini temizler. Zincirde test kanıtları kalır. Test komutlarını üretim ortamına yöneltmeyin.

Derlenmiş uygulamalar: `pnpm --filter @edument/api start` ve `pnpm --filter @edument/web start`. Öneri hizmeti Docker Compose içinde kalır. `pnpm dev` sadece API ve web geliştirme sunucularını başlatır.

## Gösterim verisi: tamamen isteğe bağlı

```bash
pnpm demo:generate --students 20 --mentors 8 --achievements 30 --seed 2204
```

Aktarım için `.env` içinde `DEMO_DATA_ENABLED=true` ve güçlü bir `DEMO_PASSWORD` belirleyin:

```bash
pnpm demo:import
pnpm demo:remove
```

Varsayılan aktarım sadece veritabanına yazar. Mentorlar kurum doğrulaması; başarılar belge ve karar bekler. `pnpm demo:import --with-chain` profil kanıtlarını kalıcı olarak zincire yazar. `demo:remove` zinciri silemez. Aynı veri kümesini yeniden aktarmadan önce önceki partiyi kaldırın. `packages/demo-data` çekirdek tarafından içe aktarılmaz; klasör silinse de API ve arayüz derlenir.

## Araştırma ve model eğitimi

API çalışırken otomatik pilot ölçümleri varsayılan olarak kaydedilir: işlem yaşam döngüsü, düğüm geçmişi, aynı blokta tutarlılık, sınırlı bütünlük kontrolü ve kaynak ölçümleri. Yönetici için günlük özet ve CSV/JSON dışa aktarımı vardır. Kurulum/güncellemede `pnpm db:generate` ve `pnpm db:migrate` çalıştırın. Kapatmak için `TELEMETRY_ENABLED=false` kullanın. Ayarlar ve ölçüm sınırları: [Otomatik ölçümler](OTOMATIK_OLCUMLER.md).

Yönetici **Araştırma Laboratuvarı** sayfasından bütünlük, belge değişikliği, sürüm, ek gecikme, çok düğüm ve sıralama deneylerini çalıştırabilir. Ölçümler JSON/CSV olarak indirilebilir. Çalışan ağ yoksa blokzincir sonucu üretilmez.

```bash
pnpm research:run INTEGRITY
pnpm research:run DOCUMENT
pnpm research:run VERSIONS
pnpm research:run OVERHEAD
pnpm research:run MATCHING
pnpm research:generate --seed 2204
node scripts/python.mjs services/matcher/research.py run
pnpm research:cleanup
pnpm matcher:train --input research-output/feedback.csv --seed 2204
```

Yerel Python komutları için `python -m venv .venv` ve `pip install -r services/matcher/requirements.txt` kullanın. Python yürütücüsü `PYTHON_BIN` ile değiştirilebilir. Öğrenilmiş model yoksa ağırlıklı model kullanılır. Eğitim açık komuttur; kendiliğinden yeniden eğitim yoktur. Sentetik etiketlerden bulunan metrikler gerçek mentorluk başarısı kanıtı değildir. [Araştırma yöntemi](ARASTIRMA_YONTEMI.md).
