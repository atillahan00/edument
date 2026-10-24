# TÜBİTAK 2204-A araştırma yöntemi

## Araştırma soruları

Onaylı dijital kayıt ve belge değişiklikleri tespit edilebiliyor mu? Sürüm geçmişi korunuyor mu? Blokzincir eklemenin yerel yazma gecikmesine maliyeti nedir? Çok özellikli bir sıralama, önceden tanımlı sentetik uygunluk ölçütünde ilgi kesişimi taban çizgisinden nasıl ayrılıyor?

## Deneyler

- **INTEGRITY:** ayrı test snapshot'ı oluşturulur, gerçek işlemle özeti yazılır; özgün snapshot ve değiştirilmiş kopya sözleşme özetiyle karşılaştırılır.
- **DOCUMENT:** ayrı sentetik bayt dizisinin SHA-256 özeti zincire yazılır; bir bayt çevrilir ve fark ölçülür. Gerçek öğrenci belgesi değiştirilmez.
- **VERSIONS:** üç gerçek işlemle V1/V2/V3 zinciri kurulur; V1/V2 içerikleri okunur, önceki kayıtların superseded ve son kaydın aktif olduğu raporlanır.
- **OVERHEAD:** aynı koşullarda PostgreSQL yazma süresi ve ek blokzincir onay süresi ölçülür. Ortalama, ortanca, p95 ve sıralı işlem/saniye hesaplanır. Bu değerler üretim kapasitesi testi değildir.
- **MULTI:** dört doğrulayıcı ve dört sağlıklı uç nokta yoksa kullanılamaz. Tek/çok ağ sonuçları farklı yapılandırmalarla ayrı çalıştırılıp kaydedilir; tek makine üstünde ağlar arası kıyas donanım paylaşımıyla sınırlıdır.
- **MATCHING:** yalnızca ilgi kesişimi ile sekiz bileşenli ağırlıklı sıralama, ayrı ve açıkça sentetik hedef etiketi üzerinde karşılaştırılır. Model eğitilmediyse uydurma ML sonucu eklenmez.

Deney tohum, örnek sayısı, ağ modu, zincir kimliği, çalışma zamanı ve işlem kanıtlarını saklar. Araştırma örnekleri `ExperimentSample` tablosundadır; öğrenci/mentor hesabına dönüşmez. Zincir kanıtları kalıcıdır. `research:cleanup` üretilen yerel araştırma dosyalarını kaldırır; saklanan deney raporlarını veya zinciri sildiğini iddia etmez.

## Metrikler

**Precision@5:** ilk beş önerinin kaçının etiketlenen uygun mentor olduğu. **Recall@5:** bütün uygun mentorların ilk beşte bulunan oranı. **MRR:** ilk uygun mentor ne kadar üstteyse o kadar yüksek. **NDCG@5:** uygun mentorların üst sıralarda olmasını ödüllendiren normalize sıralama metriği. Hiç uygun mentor olmayan sorguda recall/NDCG tanımsızdır ve ortalamada hariç tutulur; sıfır gibi sunulmaz.

Sentetik uygunluk kuralı, hedef uzmanlığı ve ortak zaman şartıdır; ağırlıklı skor formülünün kendisi hedef olarak kullanılmaz. Buna rağmen aynı özellik alanından üretildiği için yöntem lehine tasarım etkisi vardır. Bulgular gerçek öğrencilerde fayda, psikolojik uygunluk veya başarılı ilişki tahmini kanıtı sayılmaz. Gerçek araştırma için kurum/veli izinleri ve bağımsız değerlendirme gerekir.

## Tekrarlanabilirlik

Sabit seed, sürümlü kod/lockfile ve aynı node sayısıyla tekrar çalıştırın. Blokzincir gecikmesi duvar saatiyle ölçülür; aynı tohum aynı gecikmeyi garanti etmez. Isınma, arka plan yükü, disk, blok süresi ve sanallaştırma durumunu raporda belirtin. Başarısız deneyi başarılı örnek gibi raporlamayın. Başarıyla tamamlanan küçük örneklerde görülen %100 oran genel kullanılabilirlik değildir.

CSV/JSON dışa aktarımı deney yapılandırmasını içerir. Bilimsel rapora konacak sonuçlar ekran görüntüsü yerine bu dosyalardan izlenebilir olmalıdır.
