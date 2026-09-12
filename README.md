# BILSEM-Chain

Öğrenci gelişimi, kurum onaylı başarılar ve açıklanabilir mentorluk için Türkçe, yerel araştırma prototipi. PostgreSQL günlük işlemlerin kaynağıdır; Besu yalnızca değişmez bütünlük kanıtlarını tutar. Token, NFT, kripto para veya ücretli yapay zekâ hizmeti içermez.

**Blokzincir, başarının gerçekliğini kanıtlamaz. Yetkili tarafından onaylanan dijital kaydın sonradan değiştirilip değiştirilmediğini gösterir. Tek doğrulayıcı geliştirme ağı Bizans hata toleransı sağlamaz.**

## Hızlı başlangıç

Ön koşullar: Node.js 22/24 LTS, pnpm 11.19, Docker ve Docker Compose. Matcher, PostgreSQL ve MinIO konteynerlerde çalışır; ayrı Python kurulumu gerekmez. Yaklaşık 8 GB kullanılabilir bellek ve Docker imajları için disk alanı ayırın.

```bash
pnpm install
pnpm setup:local
pnpm dev
```

`setup:local`, `.env` yoksa rastgele **yalnızca geliştirmeye uygun** sırlar üretir; altyapıyı başlatır, Prisma istemcisini üretir, migration uygular, sözleşmeyi derleyip dağıtır ve yöneticiyi oluşturur. Mevcut `.env` ve yönetici parolası değiştirilmez. Servisler ilk indirmede geç hazır olursa başarısız adımdan itibaren aşağıdaki komutları tekrar çalıştırın.

Arayüz: <http://localhost:3000>. API belgesi: <http://127.0.0.1:3001/api/docs>. Yönetici e-postası ve parolası yerel `.env` içindeki `BOOTSTRAP_ADMIN_EMAIL` ve `BOOTSTRAP_ADMIN_PASSWORD` alanlarıdır. Parola konsola yazdırılmaz. Normal kurulumda **sıfır sentetik öğrenci, mentor ve başarı** bulunur.

## Adım adım tek düğüm

```bash
node scripts/setup.mjs --env-only
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm contract:compile
pnpm contract:deploy
pnpm bootstrap:admin
pnpm dev
```

Tek Besu düğümü `127.0.0.1:8545`, ağ kimliği `1337`; PostgreSQL `5432`, MinIO `9000`, MinIO yönetimi `9001`, matcher `8000`. Sözleşme adresi `deployments/1337.json` dosyasına yazılır. API, `CONTRACT_ADDRESS` boşsa bu dosyayı okur. Dağıtımı değiştirmeden önce bekleyen işleri bitirin. Anahtarlar ve başlangıç blokları `infra/besu/generated/` altında üretilir ve sürüm kontrolüne alınmaz.

`pnpm chain:single:up` yalnızca zinciri, `pnpm infra:up` bütün altyapıyı açar. `pnpm infra:down` ve `pnpm chain:single:down` hacimleri **silmez**.

## İlk gerçek kullanım

1. Yönetici ile giriş yapın; **Kurumlar** sayfasından kurum oluşturun.
2. Öğrenci ve mentor `/register` üzerinden başvursun. Hesaplar etkin olmadan oturum açılamaz.
3. **Kullanıcı Yönetimi** sayfasında hesapları etkinleştirip kurumlarını atayın. Bir hesabı `Kurum doğrulayıcısı` rolüne geçirin. Verifier yetkisi kurum üyeliğiyle sınırlıdır.
4. Öğrenci profilini doldursun. İlk kayıt V1, sonraki anlamlı düzenleme V2 olur. Geçmiş sayfasından sürümleri ve blokzincir kanıtlarını denetleyin.
5. Öğrenci PDF/PNG/JPEG kanıtıyla başarı göndersin. Doğrulayıcı kurum kuyruğundan karar versin. Onaylanan sürüm iş kuyruğundan gerçek Besu işlemine dönüşür.
6. Başarı ayrıntılarından dosyayı karşılaştırın. Değişmiş dosya `Eşleşmiyor` sonucu verir. Yeni belge, yeni başarı sürümü gerektirir.
7. Mentor profilini oluştursun; kurum uzmanlığını doğrulasın. Öğrenci **Gizlilik ve İzinler** sayfasında eşleştirme izni versin ve gerçek özellik puanlarını görsün.
8. Mentor isteği kabul etsin. Reşit olmayan öğrencide doğrulayıcı/yönetici ayrıca kurum onayı versin. Ancak bundan sonra platform içi görüşme açılır.

## Dört doğrulayıcılı ağ

```bash
pnpm chain:multi:up
```

API işlemini kapatın ve `.env` içindeki ağ ayarlarını değiştirin:

```dotenv
CHAIN_MODE=multi
CHAIN_ID=1338
BESU_RPC_URLS=http://127.0.0.1:8551,http://127.0.0.1:8552,http://127.0.0.1:8553,http://127.0.0.1:8554
BESU_WRITE_RPC_URL=http://127.0.0.1:8551
CONTRACT_ADDRESS=
```

```bash
pnpm contract:deploy
pnpm chain:status
pnpm dev
```

İş mantığı değişmez. Ağ kimliği ve başlangıç blokları denetlenir; sağlıklı düğümlerden okuma yapılır. Yazma düğümü otomatik değiştirilmez. Tek ve çok düğümlü geliştirme ağları farklı zincirlerdir; eski kanıtlar yeni ağa taşınmış sayılmaz. Ağlar arasında geçerken ayrı uygulama veritabanı kullanın veya önceki ağdaki kayıtları o ağa dönerek denetleyin. Ayrıntılar: [MULTI_NODE](docs/MULTI_NODE.md).

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

Yerel Python komutları için `python -m venv .venv` ve `pip install -r services/matcher/requirements.txt` kullanın. Python yürütücüsü `PYTHON_BIN` ile değiştirilebilir. Öğrenilmiş model yoksa ağırlıklı model kullanılır. Eğitim açık komuttur; kendiliğinden yeniden eğitim yoktur. Sentetik etiketlerden bulunan metrikler gerçek mentorluk başarısı kanıtı değildir. [Araştırma yöntemi](docs/RESEARCH_METHOD.md).

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

Derlenmiş uygulamalar: `pnpm --filter @bilsem/api start` ve `pnpm --filter @bilsem/web start`. Öneri hizmeti Docker Compose içinde kalır. `pnpm dev` sadece API ve web geliştirme sunucularını başlatır.

## Bu çalışma ortamında doğrulama

Gerçek tek düğüm Besu sözleşme dağıtımı ve kayıt işlemleri, PostgreSQL migration, MinIO belge erişimi, API–matcher bağlantısı ve kabul senaryosu çalıştırıldı. Dört gerçek Besu doğrulayıcısı üzerinde ayrıca dağıtım, işlem ve dört düğümden okuma sınandı. Kanıtlar [docs/evidence](docs/evidence) altındadır. Docker Desktop bulunmadığı için bu bilgisayarda konteyner çalıştırıldığı iddia edilmez; eşdeğer yerel süreçler kullanıldı. Tam test özeti [VALIDATION](docs/VALIDATION.md) dosyasındadır.

## Sıfırlama ve sınırlamalar

`pnpm chain:reset-local --confirm-local-reset` yalnızca açıkça yerel uç noktalar yapılandırıldığında ilgili geliştirme zinciri hacimlerini yok eder. Bu, kayıt silme özelliği değildir. Uygulama veritabanını korur; önceki zincir kanıtları artık yeni zincirde bulunmaz. İşletim arayüzü Docker veya sistem komutu başlatmaz.

Prototip üretime hazır hukuki uyumluluk, çok kurumlu bağımsız yönetişim veya gerçek mentor başarısı iddiasında bulunmaz. Antivirüs/CDR, parola kurtarma/e-posta doğrulama, HSM, yedekleme işletimi ve kurumsal saklama politikaları üretim öncesi eklenmelidir. Liste uç noktaları sayfalıdır; mevcut arayüz çoğu listede ilk 50 kaydı gösterir. Bildirim ve mesaj yenilemesi elle yapılır. [Kararlar](docs/DECISIONS.md), [tehdit modeli](docs/THREAT_MODEL.md), [gizlilik](docs/PRIVACY.md).
