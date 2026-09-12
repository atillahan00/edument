# Mühendislik kararları

1. **Özel veri zincir dışında.** Ad, iletişim bilgisi, öğrenme alanları ve belge baytları PostgreSQL/MinIO'dadır. Sözleşmede yalnızca özetler, HMAC takma referans ve bütünlük üstverisi bulunur.
2. **Tek varsayılan, çok node yapılandırması.** Tek node 1337, dört node 1338. Ayrı başlangıç blokları açık ağ ayrımı sağlar. İş mantığı ortak provider kullanır.
3. **Ortak sürüm tablosu.** Öğrenci ve başarı sürümleri `RecordVersion` ile temsil edilir. `StudentProfileVersion`/`AchievementVersion` sorumlulukları bu ortak tabloda tür ve ilişkiyle ayrılır. Değiştirilen snapshot yerinde güncellenmez.
4. **JSON özellik belgeleri.** İlgi, beceri, hedef, mentor uzmanlık/dil/zaman bilgileri sınırlanmış Zod/Pydantic belgeleridir. İzinli kategoriler serbestçe genişletilebilir. Ayrı yüzlerce lookup tablosu yerine immutable belge tutarlılığı tercih edildi. Büyük ölçekli filtreleme için normalize/GIN indekslerine geçiş gerekir.
5. **Opak oturum.** JWT yerine hash'i DB'de tutulan, 30 dakikalık HttpOnly opak çerez kullanılır. Böylece refresh token mimarisi gerekmez; logout ve rol değişikliği anında iptal eder. Süre bitince yeniden giriş gerekir.
6. **Kapalı hesap başvurusu.** Kullanıcı yalnızca öğrenci/mentor başvurusu yapabilir. Hesap aktivasyonu, kurum ve ayrı verifier rolü yöneticiye aittir. Kullanıcı kendi kurum yetkisini seçerek artıramaz.
7. **Tek belge / başarı sürümü.** Her sürümde tek PDF/PNG/JPEG kanıt vardır; belge değişikliği yeni sürümdür. Ek kanıt gerektiğinde yeni sürüm veya ayrı başarı kullanılabilir. Bu sınır arayüzde açıktır.
8. **Belge kurumda incelenir.** Kriptografik bütünlük, gerçek dünyadaki doğruluk değildir. Mentor uzmanlığı değişirse doğrulama kaldırılır.
9. **Reşit olmayan varsayımı.** Mentor kabulü ile kurum onayı ayrı durumlardır. Hiçbir genel sohbet yoktur. Yönetici/verifier mesaj içeriklerini varsayılan okuyamaz; bildirim gerekçesini görür.
10. **İmzalı işlemi önce kalıcılaştır.** Outbox DB işleminden sonra yayınlanır. Global PostgreSQL danışma kilidi nonce yarışını önler. Makbuzu olmayan imzalı çağrı diğer yeni çağrıları bekletir.
11. **Gerçek hata görünür.** RPC veya matcher yoksa açık hata/boş durum vardır. Başarısız bağlantı yerine sahte skor, işlem geçmişi veya deney metriği üretilmez.
12. **ML varsayılan kapalı.** Ağırlıklı model gerçek özelliklerden deterministik puan üretir. Lojistik regresyon yalnızca yeterli, sürümlü artifact ve açık yapılandırmayla kullanılır. Geri bildirim otomatik eğitim başlatmaz.
13. **Araştırma yalıtımı.** Deney örnekleri ayrı tabloda/dosyalardadır; öğrenci hesabı oluşturmaz. Gösterim paketi opsiyoneldir. Zincir testlerinin kalıcı etkisi açıkça belgelenir.
14. **Türkçe tasarım.** Temiz eğitim arayüzü, doğal Türkçe durumlar ve `tr-TR`. Kaynak kodu İngilizce tanımlayıcı kullanır. Temel gezinme/durum/alan metinleri merkezi sözlükte, bağlama özgü açıklamalar ilgili bileşendedir.
15. **Yerel donanım uyarlaması.** Bu makinede Docker Desktop yoktu. Besu, Java 25, PostgreSQL 17 ve kaynaktan MinIO taşınabilir olarak çalıştırıldı. PostgreSQL UTF-8 sorunu Windows kısa yoluyla çözüldü. İlk doğrudan PostgreSQL başlatıcısı görünür konsol/yeniden başlama sorunu oluşturdu; `pg_ctl` ve açık `WindowStyle Hidden` kullanımıyla değiştirildi. İzleme modundaki API kapatılarak derlenmiş süreç kullanıldı.
16. **Üretim sınırları.** Otomatik e-posta/şifre kurtarma, antivirüs/CDR, HSM, gerçek kurumsal permissioning ve hukuki veli izin süreçleri prototipte tamamlanmış sayılmaz. Üretim uygunluğu iddia edilmez.
