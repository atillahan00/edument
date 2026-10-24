# EduMent adlandırması

Ürün adı EduMent, paket kapsamı @edument, sözleşme adı EduMentRegistry olarak güncellendi. Arayüz, API ve matcher başlıkları, Windows başlatıcıları, kurulum örnekleri ve testler aynı adı kullanır.

## Mevcut yerel kurulum

Veritabanı adı, kullanıcı adı, yönetici hesabı, dosya deposu, zincir anahtarları ve dağıtılmış sözleşme adresleri değiştirilmez. Yerel .env içindeki takma kimlik sırrının yalnızca değişken adı EDUMENT_PSEUDONYM_SECRET olur; değeri korunur. Eski BILSEM_PSEUDONYM_SECRET ve BILSEM_NATIVE_ROOT değişkenleri uyumluluk için okunabilir.

Docker kullanan eski kurulumlar mevcut kaynaklarına erişmek için .env içinde EDUMENT_COMPOSE_PROJECT=bilsem-chain, EDUMENT_COMPOSE_SINGLE=bilsem-chain-single ve EDUMENT_COMPOSE_MULTI=bilsem-chain-multi değerlerini; POSTGRES_USER ve POSTGRES_DB için de mevcut değerlerini korumalıdır. Yeni kurulumların varsayılan adları edument kullanır.

Oturum çerezi edument_session olarak değiştiği için yeniden giriş gerekebilir. Görünüm tercihi edument-design anahtarında saklanır. Eski araştırma kanıtları, dağıtım kayıtları, yedek ZIP ve yerel çalışma klasörünün yolu tarihsel veridir; yeniden adlandırılmaz. Dış klasördeki eski başlatıcılar EduMent başlatıcılarına yönlenir; böylece mevcut kısayollar çalışır.

## Kaynak kodundan kurulum

pnpm install, pnpm contract:compile ve pnpm build komutlarını çalıştırın. Mevcut zincire yalnızca ad değişikliği için yeniden sözleşme dağıtmayın. GitHub'a aktarımda .env, .runtime, deployments ve diğer .gitignore kapsamındaki yerel veriler dahil edilmez.
