# Blokzincir katmanı

Besu `26.8.1`, QBFT ve Ethereum uyumlu JSON-RPC kullanılır. Tek doğrulayıcı geliştirme ağı dağıtık güven veya Bizans hata toleransı sağlamaz. Dört doğrulayıcı aynı bilgisayarda çalıştırıldığında da bilgisayar arızasına karşı bağımsızlık sağlanmaz.

Sözleşmedeki tek veri sınıfı bütünlük üstverisidir: rastgele kayıt kimliği, HMAC-SHA256 takma kişi referansı, tür özeti, içerik ve belge SHA-256 özetleri, önceki/sonraki kayıt bağlantısı, sürüm, yetkili imzalayıcı, zaman ve durum. İsim, UUID, e-posta, hedef, beceri, açıklama ve dosya baytları yazılmaz. Sözleşme standart OpenZeppelin `RoleGranted` / `RoleRevoked` olaylarıyla rol değişimlerini bildirir.

`DEFAULT_ADMIN_ROLE` rol yönetir; `ANCHOR_ROLE` yeni kayıt ekler; `VERIFIER_ROLE` mevcut kaydı iptal eder. Uygulama öğrencisi/mentoru tarayıcıda cüzdan taşımaz. Uygulama rolleri sözleşme rollerinden bağımsızdır. Prototipte yetkili API imzalayıcısı kurum işlemlerini yürütür; hangi kurum görevlisinin karar verdiği özel veritabanı denetiminde tutulur.

Yeni sürüm aynı takma kişi ve türün etkin önceki sürümünü göstermeli, zincir sürümü bir artmalıdır. Dallanma, üzerine yazma ve sürüm atlama reddedilir. İptal/supersession geçmiş hash'leri silmez. Başarı başvurusu sürümü ile zincire onaylanmış sürüm sayısı farklı olabilir; `version` ve `chainVersion` bu nedenle ayrıdır.

## Özet üretimi

Zod iş verisini doğrular. JSON anahtarları RFC 8785 uyumlu `canonicalize` ile sıralanır, dizilerin sırası korunur, metin değerleri NFC'ye dönüştürülür. Tarih gibi anlamlı iş verisi snapshot'a dahildir; DB oluşturulma zamanı, işlem makbuzu ve geçici UI alanları değildir. Belge özeti tam baytlar üzerinden alınır. Değişmiş dosya, değiştirilmemiş dosyayla aynı sonucu vermez.

## İşçi ve kurtarma

Durumlar: PENDING → SUBMITTED → CONFIRMED; geçici hatalar RETRYING, sınırlı üstel gecikme sonrası FAILED. PostgreSQL danışma kilidi, aynı imzalayıcıyı kullanan işçileri sıralar. Önceki sürüm onaylanmadan sonraki kayıt gönderilmez. İmzalı fakat makbuzu eksik işlem varken yeni nonce üretilmez. Yeniden deneme aynı ham işlemi kullanır. Onaylı iş ikinci işlem üretmez.

Sözleşmede geri çevrilen işlem düzeltilmiş gibi gösterilmez. Yönetici hata nedenini araştırmalıdır; aynı imzalı çağrı tekrar gönderilirse aynı iş kuralı hatası devam eder. Özel anahtar kaybında üretim anahtar kurtarma ve rol devir süreci gerekir.

## İzinli ağ sınırı

Yerel Docker RPC portları yalnızca loopback'e açılır; düğümler özel Compose ağı ve sabit eş listeleri kullanır. Bu ağ, kurumsal hesap/node allowlist'i zorunlu tutulmuş üretim ağı değildir. Kurum dağıtımında Besu node/account permissioning, güvenlik duvarı, TLS ağ geçidi, ayrı yönetici anahtarı ve Vault/HSM eklenmelidir.

Birincil kaynaklar: [Besu QBFT kurulumu](https://docs.besu-eth.org/private-networks/tutorials/qbft), [OpenZeppelin AccessControl](https://docs.openzeppelin.com/contracts/5.x/access-control), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).
