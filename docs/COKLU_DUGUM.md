# Tek düğümden dört doğrulayıcıya

`infra/besu/single/compose.yml` bir, `infra/besu/multi/compose.yml` dört gerçek Besu QBFT doğrulayıcısı tanımlar. Anahtarlar `scripts/genesis.ts` ile kriptografik rastgele oluşturulur. RLP başlangıç verisinde doğrulayıcı adresleri sıralıdır. Açık anahtarlardan sabit eş listeleri üretilir. Mevcut başlangıç dosyası ve anahtarlar sıradan başlatmada korunur.

| Mod    | Chain ID | Host RPC               | Varsayılan validator |
| ------ | -------: | ---------------------- | -------------------: |
| single |     1337 | 8545                   |                    1 |
| multi  |     1338 | 8551, 8552, 8553, 8554 |                    4 |

API `BlockchainProviderManager` üzerinden endpoint listesi alır. Her sağlık kontrolünde chain ID, genesis, son blok ve mümkünse peer/validator bilgisi alınır. Aynı chain ID ile farklı genesis algılanırsa tüm okumalar engellenir. Bir endpoint yanlış zincirdeyse dışlanır. `BESU_GENESIS_HASH` ile beklenen genesis ayrıca sabitlenebilir. RPC kimlik bilgileri yönetim yanıtına yazılmaz.

Okuma çağrıları yalnızca doğrulanmış sağlıklı endpoint'lerde denenir. Yazma için `BESU_WRITE_RPC_URL` yapılandırılmış listede bulunmalıdır. Yazma düğümü kapanırsa iş kuyrukta bekler; nonce güvenliği nedeniyle başka düğüme gizlice taşınmaz. Yönetici erişimi düzeltir veya bilinçli yapılandırma değişikliği yapar.

## Sınama

```bash
pnpm chain:multi:up
node --import tsx scripts/multi-smoke.ts
```

Smoke betiği dört node yanıtını, aynı zinciri/genesis'i, blok ilerlemesini, gerçek sözleşme dağıtımını, kayıt işlemini ve her dört node'dan aynı hash'in okunmasını doğrular. Başarılı kanıt `docs/evidence/multi-node.json` dosyasına yazılır. Prototip geliştirilirken Docker yerine aynı genesis ve dört yerel Besu süreciyle bu sınama başarılı çalıştırılmıştır.

Dört endpoint'e erişebilmek, dört bağımsız kurum veya bütün saldırılara dayanıklılık değildir. Aynı sunucudaki dört düğüm aynı elektrik, disk ve yönetici riskini taşır. Üretimde ayrı kurumsal makineler, ağ kimlik doğrulaması ve permissioning gerekir. Genel QBFT hata toleransı için en az dört doğrulayıcı gerekir; tek node için böyle bir iddia yoktur.

## Ağ değiştirme

Tek/çok geliştirme ağları farklıdır; PostgreSQL `BlockchainAnchor` zincir kimliğini ve sözleşme adresini saklar. Eski bir kayıt diğer ağa yanlışlıkla doğrulanmaz. Deney karşılaştırmaları için ayrı veritabanları veya boş araştırma ortamları tercih edin. Bekleyen işleri eski ağda sonuçlandırmadan yapılandırma değiştirmeyin. `single:down` ve `multi:down` hacimleri silmez.

Yönetim sayfası yalnızca ölçüm yapar. Docker, node başlatma/durdurma veya sistem kabuğu web sunucusundan çağrılmaz.
