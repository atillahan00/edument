# Otomatik pilot ölçümleri

Kurulum: `pnpm db:generate`, `pnpm db:migrate`, ardından API'yi yeniden derleyip başlatın. Veritabanı geçişi yalnızca yeni `TelemetryEvent` tablosunu ekler; mevcut kullanıcı ve zincir kayıtlarını dönüştürmez. Eski verilerden geçmiş ölçümler üretilmez.

API ile birlikte otomatik başlar. `TELEMETRY_ENABLED=false` ile kapatılır. Pilot için `TELEMETRY_ENVIRONMENT=pilot`, ayrı test ağı için `experiment` kullanın; ayrı veritabanları ve zincirler tercih edin. `APP_VERSION` alanına dağıtılan kodun sürümünü yazın. Her API başlangıcı ayrı runId taşır.

Varsayılan ağ örneklemesi 60 saniye; bütünlük kontrolü saatte 3 kayıt. `TELEMETRY_INTERVAL_MS` (en az 10000), `TELEMETRY_INTEGRITY_INTERVAL_MS` (en az 60000), `TELEMETRY_INTEGRITY_SAMPLES` (1–20) ile değişir. Dosya bayt kontrolü depoya yük getirdiği için `TELEMETRY_DOCUMENT_CHECKS=true` ile ayrıca açılır. Dönen kayıt kimliği sırasıyla sınırlı örnek alınır; rastgele veya tam kapsamlı kontrol iddiası yoktur.

## Saklanan veriler

- İş kuyruğunun ilk oluşturulma zamanı, imzalama, gönderim, yeniden deneme, bekleme, makbuzun gözlenmesi ve hata olayları. totalMs kuyruktan uygulamanın onayı görmesine kadar; sinceSignedMs imzalamadan makbuzun gözlenmesine kadardır. Bunlar kesin konsensüs süresi değildir. Yeni işlem üretmez.
- Her düğümün erişimi, gecikmesi, blok yüksekliği, geri kalma miktarı, değişmeyen blok süresi ve gözlenen erişim geri dönüşü. RPC'nin yanıt vermesi blok üretimi demek değildir. Recovery alanı yeniden erişimi ölçer; eşitlenme için lagBlocks ayrıca incelenir.
- Aynı blok yüksekliğinde hash karşılaştırması. İki düğümden azsa veya bir cevap eksikse INSUFFICIENT_DATA. Tek sunucudaki uyum bağımsız kurumsal yönetişim kanıtı değildir.
- Sınırlı bütünlük kontrolü: VALID, MISMATCH, ERROR, PENDING vb. Dosya kontrolü depodaki baytları kayıtlı belge hash'iyle karşılaştırır; kayıt hash'i ayrıca zincirle karşılaştırılır. Ulaşılamayan veri bozulmuş sayılmaz.
- API süreç CPU/RAM, host belleği, uygulama diski boş alanı ve API yanıt süresi örnekleri. Besu'nun CPU kullanımı ayrıca ölçülmez. HTTP istek gövdesi, URL, IP, çerez veya kullanıcı adı saklanmaz. Her aralıkta ilk 10000 gecikme saklanır; aşılması truncation alanıyla belirtilir.

Ölçümler PostgreSQL'e yazılır, blokzincire yazılmaz. Veritabanı hatası iş akışına fırlatılmaz. En fazla 5000 gözlem bellekte bekler, 5 saniyede 500 kayıt toplu yazılır. Tam süreç çökmesinde henüz yazılmamış gözlemler kaybolabilir. Kuyruk taşması ayrıca raporlanır. Ölçüm boşluklarını başarılı süre gibi saymayın. API başlangıç/bitiş olaylarını ve örnekleme aralıklarını inceleyin. Birden fazla API kopyası çalışıyorsa gözlemleri runId ile ayırın; ağ ölçümleri tekrarlanabilir.

Sunucu tamamen kapandığında kendi izleyicisi de kapanır. Kesin erişilebilirlik oranı için başka bir makineden dış izleme gerekir. Veriler kendiliğinden silinmez: 30 günlük pilot için disk/yedekleme planlayın ve sunucuyu iptal etmeden PostgreSQL, belgeler ve zinciri arşivleyin.

## Yönetici erişimi ve dışa aktarma

Yönetici oturumu gerektirir; `/api/docs` üzerinden de görülebilir:

- `GET /api/v1/telemetry/status`: açık/kapalı ve son gözlem.
- `GET /api/v1/telemetry/daily?from=2026-09-26T00:00:00Z&to=2026-10-27T00:00:00Z`: veritabanındaki ölçümlerden hesaplanan günlük UTC özetleri. Günlük ek dosya üretmez.
- `GET /api/v1/telemetry/export?from=2026-09-26T00:00:00Z&to=2026-10-27T00:00:00Z&format=csv`: tüm ham kayıtların akış halinde dışa aktarımı. JSON da desteklenir. CSV uzun format: olay, zaman, ortam, çalışma, zincir, tür, metrik, değer. İç içe değerler JSON'dur.

Tarih aralığı başlangıç dahil, bitiş hariç ve en fazla 93 gündür; environment parametresiyle ortam seçilebilir. Özet, gün içinde gözlenen olayları sayar; başarısızlık/başarı yüzdesi değildir. Başarısız iş daha sonra başarılı olabilir. İşleri jobId üzerinden tekilleştirip başlangıç kohortu ve takip penceresi belirlemeden başarı oranı hesaplamayın. Bekleyen işlerin son durumu queue.snapshot kayıtlarındadır.

Pilot sırasında düğüm kapatma, yük üretme veya kullanıcı verisi değiştirme yapılmaz. Müdahaleli deneyleri ayrı dört fiziksel doğrulayıcı ağında yürütün.
