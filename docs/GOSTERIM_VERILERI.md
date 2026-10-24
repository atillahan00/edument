# İsteğe bağlı gösterim verisi

Çekirdek hiçbir başlangıç kancasında veri üretmez. Normal akışta sadece açık yönetici bootstrap'ı çalışır. `packages/demo-data` Next.js, NestJS veya matcher tarafından içe aktarılmaz; workspace derlemesinin gerekli bir üyesi değildir.

`demo:generate` sabit xorshift PRNG ve tohumla aynı JSON dosyasını üretir. Kişiler `KURGUSAL` adları ve `example.invalid` e-postaları taşır. Rastgele oluşturulan gerçek kişi kimliği yoktur. `--students`, `--mentors`, `--achievements`, `--seed` desteklenir.

`DEMO_DATA_ENABLED=true` ve en az 12 karakterli, büyük/küçük harf ve rakam içeren `DEMO_PASSWORD` olmadan aktarım reddedilir. Parola Argon2id ile hash'lenir. Tüm kullanıcılar `demoSeedBatchId` ile etiketlenir; son parti `demo-output/last-batch.json` dosyasında takip edilir.

Varsayılan aktarım zincire yazmaz. Gösterim mentoru doğrulanmış gibi gösterilmez; başarı başvuruları kanıt olmadan onaylanmaz. Gerekli dosya yeni sürüm olarak yüklendikten sonra normal doğrulama akışı izlenir. `--with-chain` öğrenci profil sürümlerini gerçek iş kuyruğuna gönderir; uygulama yerine sahte işlem özeti üretmez.

`demo:remove` son partinin uygulama kullanıcılarını ve ilişkilerini kaldırır. Zincir kayıtlarını silmez. Demo verileriyle sonraki etkileşimlerde yüklenmiş MinIO nesneleri için saklama/temizlik politikası uygulanmalıdır; bu komut zincir sıfırlama değildir. Açık yerel `chain:reset-local --confirm-local-reset` bütün ilgili geliştirme ağı hacmini yok eder; tek bir kaydı silmez.

Araştırma verileri bu paketten bağımsızdır. Araştırma üretimi normal kullanıcı tablolarına yazmaz.
