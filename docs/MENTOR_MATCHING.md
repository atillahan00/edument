# Açıklanabilir mentor eşleştirme

Varsayılan strateji `WeightedExplainableMatcher`, model sürümü `weighted-v1`.

| Bileşen           | Ağırlık | Hesaplama                                                         |
| ----------------- | ------: | ----------------------------------------------------------------- |
| İlgi              |    0,25 | Öğrencinin ilgi sözcüklerinin mentor ilgi/uzmanlığında kapsanması |
| Hedef             |    0,25 | Hedef sözcüklerinin mentor hedef/uzmanlığında kapsanması          |
| Beceri geliştirme |    0,20 | Öz değerlendirmesi 5'ten düşük becerilerin uzmanlıkla örtüşmesi   |
| Uygunluk          |    0,10 | Öğrenci zaman dilimlerinin mentorla kesişen oranı                 |
| Deneyim           |    0,08 | En çok 1 olacak şekilde yıl / 10                                  |
| Dil               |    0,05 | İstenen dillerin karşılanma oranı                                 |
| Biçim/konum       |    0,04 | Uyumlu görüşme biçimi; yüz yüze için aynı şehir                   |
| Kapasite          |    0,03 | Kalan / toplam kapasite; dolu mentor listeden çıkarılır           |

Ağırlık toplamı 1 olmalıdır; yönetici ayarı API ve matcher tarafından doğrulanır. Eksik öğrenci alanı tam uyum kabul edilmez, sıfır bileşen üretir. Aynı girdi aynı sonucu verir; eşit puanlarda kimlik sırası deterministiktir. Açıklama, her bileşenin puanını ve toplam katkısını gösterir. Ad, e-posta, cinsiyet, din, etnik köken, engellilik, siyasi görüş ve sağlık özellik değildir.

Sözcük kesişimi Türkçe için sınırlı bir başlangıç yöntemidir; eşanlamlı, çekimli sözcükler ve derin anlamsal yakınlık modellenmez. Saatler prototipte ortak metin slotlarıdır, saat dilimi motoru değildir. Sayı, öğrenenin değeri veya zekâsı olarak yorumlanamaz.

## İsteğe bağlı lojistik model

`pnpm matcher:train --input <CSV> --seed 2204`, izinli 8 özellik sütunu ve ikili `outcome` hedefi ister. En az 50 gözlem, her sınıfta en az 10 örnek aranır. Ayrılmış test bölümüyle accuracy ve ROC-AUC gerçekten ölçülür. JSON model artifact'i özellik listesi, katsayılar, intercept, tohum, eğitim zamanı, eğitim veri hash'i ve ölçümleri saklar; pickle çalıştırılmaz.

Etkinleştirme için matcher sürecinde `MATCHER_USE_ML=true`, `MATCHER_MODEL_PATH=<artifact.json>` gerekir. Varsayılan kapalıdır. Lojistik katkılar yüzde toplamı değil logit katkılarıdır; arayüz model adını gösterir. Herhangi bir geri bildirim geldiğinde model kendiliğinden eğitilmez. Yanlış model dosyası açık hata verir.
