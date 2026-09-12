# Doğrulama kaydı

Doğrulama ortamı: Windows, Node.js 24.16.0, PostgreSQL 17.6, Besu 26.8.1 ve Java 25. MinIO, sabit sürüm kaynağından yerelde derlendi. Python hizmeti yerel sanal ortamda çalıştı. Gerçek servislerin yerine mock sunucular kullanılmadı.

## Çalıştırılan kontroller

| Kontrol                                                          | Sonuç                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Bağımlılık kurulumu ve Prisma istemci üretimi                    | Başarılı                                                                       |
| PostgreSQL migration ve yönetici bootstrap                       | Başarılı                                                                       |
| API ve frontend TypeScript denetimi                              | Başarılı                                                                       |
| Solidity derlemesi                                               | Başarılı, 0.8.28 / London                                                      |
| Hardhat                                                          | 6 test başarılı                                                                |
| Backend / paylaşım / RPC / araştırma birim testleri              | 20 test başarılı                                                               |
| Python matcher ve açık model eğitimi                             | 8 test başarılı                                                                |
| Next.js ve NestJS üretim derlemesi                               | Başarılı                                                                       |
| Gerçek servislerle API kabul senaryosu                           | Başarılı; kanıt dosyası aşağıda                                                |
| Gerçek 4 Besu doğrulayıcısı                                      | Başarılı; aynı genesis, üç eş/düğüm, ilerleyen blok, dört düğümden kayıt okuma |
| Tarayıcı: giriş, yönetim/ağ, başvuru, mobil                      | 3 test başarılı                                                                |
| Tarayıcı: öğrenci profili, PDF, verifier onayı, bütünlük, öneri  | 1 test başarılı                                                                |
| Gösterim generate/import/remove                                  | Başarılı; varsayılan DB-only modu                                              |
| Araştırma: bütünlük, belge, V1–V3, ek gecikme, mentor sıralaması | Gerçek ölçümlerle tamamlandı                                                   |

Başarılı akışlara ulaşmadan önce Windows izin/yol sorunları, PostgreSQL konsol döngüsü, kapatılmış MinIO ve test seçici/fixture sorunları bulundu ve giderildi. İlk başarısız denemeler başarı olarak sayılmadı. Doğrudan PostgreSQL launcher'ı yerine gizli pencereli `pg_ctl` kullanılır.

## İzlenebilir kanıtlar

- `evidence/integration.json`: gerçek tek node işlem özetleri, blok numaraları ve kontrol listesi. V1/V2 korunması, belge farkı, kurum/rol erişimi, gizli QR, matcher, reşit olmayan onayı, görüşme sınırı, izin geri çekme ve logout sınanır.
- `evidence/multi-node.json`: 1338 ağında dört node sağlık ve işlem kanıtı. Fiziksel olarak aynı makinededir; bağımsız kurum testi değildir.
- `evidence/experiments.json`: çalıştırılmış deneylerin yapılandırma ve ölçümleri. Örnek sayıları küçüktür; genel hız veya gerçek mentor başarısı iddiası desteklemez.
- `evidence/final-state.json`: en son servis HTTP durumları ve boş gösterim kullanıcı sayıları.

**Docker Compose motor testi yapılmadı:** bu bilgisayarda Docker Desktop yoktur. Compose dosyaları sağlanmıştır; gerçek tek ve dört node sınaması taşınabilir Besu süreçleriyle yapılmıştır. Bu ayrım, konteyner ortamının doğrulandığı şeklinde yorumlanmamalıdır.

Öğrenci/mentor/başarı test verileri uygulama veritabanından ve özel belge deposundan temizlenir. Zincirdeki test özetleri kalıcıdır. Araştırma raporları gerçek çalıştırılmış deneyler olarak saklanır; demo kullanıcıları değildir.
