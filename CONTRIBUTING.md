# EduMent'e katkıda bulunma

Hata bildirimlerini, özellik önerilerini ve değişiklik açıklamalarını Türkçe yazın. Kodda kullanılan API alanları, ortam değişkenleri ve araçların beklediği dosya adları teknik sözleşmelerin parçasıdır; yalnızca çeviri amacıyla değiştirmeyin.

## Geliştirme ortamı

1. [Kurulum rehberindeki](docs/KURULUM.md) ön koşulları tamamlayın.
2. Değişiklik için ayrı bir Git dalı açın.
3. Kullanıcıya görünen metinlerde Türkçe karakterleri ve **EduMent** yazımını kullanın. Paket kapsamı `@edument`, akıllı sözleşme adı `EduMentRegistry` olarak korunur.
4. İşleyiş değiştiğinde ilgili belgeyi de güncelleyin.

## Değişikliği doğrulama

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Etkilenen bileşene göre Python, gerçek servis veya tarayıcı testlerini de çalıştırın. Ön koşullar [geliştirme rehberinde](docs/GELISTIRME.md) açıklanır. Çalıştırılmayan kontrolleri değişiklik açıklamasında belirtin; tarihsel kanıt dosyalarını yeni sonuçlar gibi sunmayın.

## Değişiklik önerisi gönderme

Önerinizde çözülen sorunu, yeni davranışı ve doğrulama sonucunu açıklayın. Veri modeli veya ortam ayarları değişiyorsa mevcut kurulumların nasıl güncelleneceğini ekleyin. `.env`, kişisel öğrenci bilgileri, belgeler, parolalar ve özel anahtarlar paylaşılmamalıdır.

GitHub'da [hata bildirimi veya özellik önerisi](https://github.com/atillahan00/edument/issues/new/choose) açabilirsiniz. Gerçek kullanıcı verileri yerine sentetik örneklerle yeniden üretim adımlarını paylaşın.
