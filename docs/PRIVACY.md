# Gizlilik ve reşit olmayan kullanıcıların korunması

Varsayılan tüm alan görünürlükleri PRIVATE, açık başlık gösterimi ve mentor görünürlüğü kapalıdır. Ad/e-posta yalnızca hesap işlemleri ve yetkili yönetim için tutulur. Öğrencilerin herkese açık aranabilir profili veya iletişim dizini yoktur. İşlem özetleri bile halka açık QR'de varsayılan olarak gösterilmez.

Başarı QR tokeni 32 rastgele bayttır; iç UUID veya takma kişi referansı URL'ye girmez. Token sahibi, varsayılan olarak yalnızca bütünlük durumunu görür. Başlık paylaşımı için hem `achievements=PUBLIC`, hem `publicTitle=true`, hem en güncel `PUBLIC_SHARE` izni gerekir. İzin geri çekilince aynı URL daha önce izin verilen başlığı artık göstermez. İptal edilmiş kayıt geçerli gibi sunulmaz.

Eşleştirme `MATCHING` izni gerektirir. Geri çekilince yeni sıralama reddedilir ve saklanan öneriler silinir. İzin günlüğü aktör, tür, politika sürümü, zaman ve verilen/geri çekilen durumları saklar. Başlangıç hesap işleme izni ayrı TERMS kaydıdır. Hesap silme/kurumsal saklama gereksinimleri otomatik hukuki kararlar olarak uygulanmaz.

Belgeler özel MinIO kovasındadır. Yetkili API belgeyi indirme eki olarak iletir; tahmin edilebilir dosya yolu veya herkese açık bucket yoktur. Dosya MIME türü, imza ve 10 MB sınırı denetlenir. Dosya yenilenince önceki belge yerinde değiştirilmez. İndirme izinleri her istekte yeniden değerlendirilir.

Kurum doğrulayıcıları yalnızca üyesi oldukları kurumun başarılarını inceleyebilir. Mentorlar öğrenci özel başarılarını veya geçmiş snapshot'larını otomatik alamaz. Görüşme sadece katılımcılara açıktır; yönetici/verifier olmak mesaj okuma yetkisi sağlamaz. Bildirim gerekçesi yönetime görünür; bildirim görüşmeyi koruyucu olarak kapatır.

Öğrencinin reşit olmadığı varsayılır. Mentor kabulünden sonra ayrıca kurum onayı gerekir. Kimlik/yaş doğrulaması kurumun operasyonel sorumluluğudur; bir onay kutusu yasal veli onayı değildir. Üretim için veli/kurum süreçleri, veri sorumlusu, saklama süresi, erişim denetimi ve KVKK açısından hukuki inceleme gereklidir. **Tam KVKK uyumluluğu iddia edilmez.**

Hash ve HMAC referansları bütünüyle anonim kabul edilmemelidir. Düşük entropili bir içeriğin hash'i tahmin saldırısına açıktır; özel RPC sınırı korunmalıdır. İzin çekme blokzincirden silme anlamına gelmez. Günlükler parolaları, çerezleri, anahtarları veya belge içeriklerini içermez.
