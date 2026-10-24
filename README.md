# EduMent

**Öğrenci gelişimi, doğrulanabilir başarı kayıtları ve açıklanabilir mentor eşleştirmesi.**

EduMent; öğrencilerin gelişimini sürümler halinde izleyen, başarı belgelerini kurum onayından geçiren ve mentor önerilerinin gerekçelerini gösteren Türkçe bir araştırma prototipidir. Öğrenciler, mentorlar, kurum doğrulayıcıları ve yöneticiler aynı platformda kendi yetkileriyle çalışır.

[Kurulum](docs/KURULUM.md) · [Belgeler](docs/README.md) · [Geliştirme ve test](docs/GELISTIRME.md) · [Katkıda bulunma](CONTRIBUTING.md)

## Neler sunar?

- **Gelişim geçmişi:** Öğrenci profilleri ve başarılar için sürümlü kayıtlar.
- **Kurum onayı:** Başarı belgelerinin yetkili doğrulayıcılar tarafından incelenmesi.
- **Bütünlük kontrolü:** Onaylanmış kayıtların ve belgelerin sonradan değiştirilip değiştirilmediğinin denetlenmesi.
- **Mentor eşleştirmesi:** İlgi, beceri ve hedeflere dayalı, gerekçeleri görülebilen öneriler.
- **İzin ve gizlilik:** Kurum kapsamlı yetkilendirme, görünürlük tercihleri ve reşit olmayanlar için ek onay.
- **Araştırma araçları:** Tek veya dört doğrulayıcılı ağ, deneyler, otomatik ölçümler ve CSV/JSON dışa aktarımı.

> Blokzincir, başarının gerçekliğini tek başına kanıtlamaz. Yetkili tarafından onaylanan dijital kaydın sonradan değiştirilip değiştirilmediğini gösterir. EduMent token, NFT veya kripto para içermez; ücretli yapay zekâ hizmetine ihtiyaç duymaz.

## Roller

| Rol                 | Yapabilecekleri                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Öğrenci             | Profilini düzenler, başarı belgesi gönderir, izinlerini yönetir ve mentor talebi oluşturur.       |
| Mentor              | Uzmanlık profilini oluşturur, eşleşme taleplerini değerlendirir ve onaylanan görüşmelere katılır. |
| Kurum doğrulayıcısı | Kendi kurumundaki başarıları, mentor uzmanlığını ve gerekli kurum onaylarını değerlendirir.       |
| Yönetici            | Kullanıcıları, kurumları, ağ durumunu ve araştırma ölçümlerini yönetir.                           |

## Hızlı başlangıç

Gerekenler: **Node.js 22 veya 24 LTS**, **pnpm 11.19**, **Docker** ve **Docker Compose**. Öneri hizmeti, PostgreSQL ve MinIO konteynerlerde çalışır; bu yol için ayrıca Python kurmanız gerekmez.

```bash
git clone https://github.com/atillahan00/edument.git
cd edument
pnpm install
pnpm setup:local
pnpm dev
```

| Erişim          | Adres                            |
| --------------- | -------------------------------- |
| EduMent arayüzü | <http://localhost:3000>          |
| API belgeleri   | <http://127.0.0.1:3001/api/docs> |

İlk kurulum, yoksa `.env` dosyasını ve geliştirme parolalarını oluşturur. Yönetici bilgileri bu dosyadaki `BOOTSTRAP_ADMIN_EMAIL` ve `BOOTSTRAP_ADMIN_PASSWORD` alanlarındadır. Mevcut parolalar değiştirilmez; örnek öğrenci, mentor veya başarı kaydı kendiliğinden eklenmez.

İlk hesap başvuruları, dört düğümlü ağ ve servis yönetimi için [ayrıntılı kurulum rehberini](docs/KURULUM.md) izleyin.

### Hazır Windows kurulumu

Taşınabilir servisleri ve bağımlılıkları önceden hazırlanmış Windows çalışma alanlarında:

- **[EduMent Ac.cmd](EduMent%20Ac.cmd):** Tek düğüm veya dört doğrulayıcılı ağ seçerek uygulamayı açar.
- **[EduMent Kapat.cmd](EduMent%20Kapat.cmd):** Bu projeye ait taşınabilir servisleri durdurur; verileri silmez.

Bu dosyalar tek başına kurulum yapmaz. GitHub'dan indirilen kopyada `.runtime`, `.venv` ve `.env` bulunmaz. Docker ile başlayan yeni kurulumlar yukarıdaki komutları kullanmalıdır. Ayrıntılar: [Windows yerel servisleri](docs/WINDOWS_YEREL.md).

## Teknik yapı

| Bileşen       | Teknoloji ve sorumluluk                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| Web arayüzü   | Next.js, React ve TypeScript; Türkçe ekranlar ve dört görünüm seçeneği.                 |
| API           | NestJS ve Prisma; oturumlar, kurum yetkileri ve iş kuralları.                           |
| Veritabanı    | PostgreSQL; uygulama kayıtlarının ana kaynağı.                                          |
| Belge deposu  | MinIO; özel erişimli kanıt dosyaları.                                                   |
| Öneri hizmeti | Python ve FastAPI; açıklanabilir sıralama, isteğe bağlı model eğitimi.                  |
| Blokzincir    | Hyperledger Besu ve Solidity; bütünlük özetleri, sürüm bağlantıları ve iptal kayıtları. |

```text
apps/web/             Türkçe kullanıcı arayüzü
apps/api/             API, veri modeli ve veritabanı geçişleri
services/matcher/     Mentor öneri hizmeti
packages/contracts/   EduMentRegistry akıllı sözleşmesi
packages/shared/      Ortak veri doğrulama şemaları
packages/demo-data/   İsteğe bağlı gösterim verileri
infra/                Tek ve çok düğümlü ağ yapılandırmaları
scripts/              Kurulum, işletim ve araştırma komutları
tests/                Birim ve tarayıcı testleri
docs/                 Türkçe rehberler ve doğrulama kayıtları
```

## Doğrulama

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Python, gerçek servis ve tarayıcı testlerinin ön koşulları [geliştirme rehberinde](docs/GELISTIRME.md); tarihli sonuçlar ve kapsam sınırları [doğrulama kaydında](docs/DOGRULAMA.md) açıklanır. Başarılı bir derleme, tüm bütünleşme senaryolarının çalıştırıldığı anlamına gelmez.

## Projenin durumu

EduMent bir **yerel araştırma prototipidir**. Tek doğrulayıcılı ağ Bizans hata toleransı sağlamaz; aynı bilgisayardaki dört düğüm bağımsız kurumlar arası yönetişimi temsil etmez. Gerçek kullanım öncesi yedekleme, saklama politikaları, dosya güvenliği ve hesap kurtarma süreçleri ayrıca ele alınmalıdır.

[Gizlilik](docs/GIZLILIK.md) · [Tehdit modeli](docs/TEHDIT_MODELI.md) · [Tasarım kararları](docs/TASARIM_KARARLARI.md) · [Eski kurulumdan EduMent'e geçiş](docs/AD_DEGISIKLIGI.md)
