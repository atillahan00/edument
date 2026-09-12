# Tehdit modeli

| Tehdit                                 | Uygulanan kontrol                                                          | Kalan sınır                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Öğrencinin kendi başarısını onaylaması | Backend rol ve kurum kontrolü                                              | Yönetici hesabının ele geçirilmesi                                                        |
| Başka kurumun belgesine IDOR           | Kayıt sahibi / yetkili kurum kontrolü                                      | Yetkili kişinin indirdiği kopya geri alınamaz                                             |
| Geçmiş snapshot'ın değiştirilmesi      | Yeni sürüm yazımı ve zincir hash karşılaştırması                           | DB yöneticisinin kötü niyeti tespit edilir; engelleme için ayrı işletim yetkileri gerekir |
| Şifre tahmini                          | Argon2id, uzun parola, giriş deneme sınırı                                 | E-posta doğrulama/MFA prototip kapsamı dışı                                               |
| Oturum hırsızlığı / CSRF               | HttpOnly, SameSite=Strict, Origin/Sec-Fetch-Site, 30 dakika, logout iptali | Üretimde HTTPS ve Secure çerez zorunlu                                                    |
| Zararlı belge                          | MIME/imza, boyut sınırı, özel depo, indirme eki                            | Antivirüs/CDR yok; içeriğin zararsızlığı garanti edilmez                                  |
| Nonce çakışması / tekrarlı kayıt       | Tek imzalayıcı kilidi, yayın öncesi ham işlem saklama, aynı işlemle retry  | Harici yazılım aynı anahtarı kullanmamalı                                                 |
| Yanlış ağ RPC'si                       | Chain ID ve genesis karşılaştırması; isteğe bağlı sabit genesis            | Tüm RPC'lerin ele geçirilmesi ayrı güven sınırıdır                                        |
| Tek düğüm arızası                      | Açık geliştirme uyarısı ve hata durumu                                     | Tek düğümde hata toleransı yok                                                            |
| Reşit olmayanla yetkisiz iletişim      | Mentor kabulü + kurum onayı + katılımcı erişimi                            | İçerik moderasyonu ve veli süreçleri kurumda                                              |
| Sahte “AI” puanı                       | Özellik bileşenleri, sabit sürüm, açık ağırlıklar                          | Sentetik değerlendirme gerçek başarıya genellenemez                                       |

Uygulama ile blockchain imzalayıcısı aynı güven alanındadır. Kötü niyetli imzalayıcı sahte onaylı dijital kayıt yazabilir. Blokzincir kurumsal delil incelemesinin yerine geçmez. Dört düğümün tek fiziksel makinede olması dört bağımsız kurum anlamına gelmez.

Üretim öncesi bağımsız güvenlik incelemesi, kayıt/erişim saklama politikası, anahtar rotasyonu, yedekleme ve geri yükleme testi, TLS, kurumsal permissioning, kötüye kullanım incelemesi gerekir.
