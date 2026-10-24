# EduMent Windows yerel servisleri

Geçmiş doğrulama ortamında Docker bulunmadığı için `.runtime` altına yerel geliştirme araçları indirildi. Sistem hizmeti kurulmadı, sistem PATH'i değiştirilmedi. `.runtime` sürüm kontrolü dışında ve indirilen araçlar yeniden dağıtımın zorunlu parçası değildir.

**PostgreSQL'i doğrudan `postgres.exe` veya ayrılmış konsol süreçleriyle başlatmayın.** Bu ortamda alt süreçler görünür konsollar açıp konsol kapandıkça yeniden başlama döngüsüne girdi. Bunun yerine `scripts/portable-postgres.ps1` içindeki `pg_ctl` denetleyicisi ve `Start-Process -WindowStyle Hidden` kullanılır.

PowerShell:

```powershell
$env:EDUMENT_NATIVE_ROOT='D:\EduMent'
.\scripts\portable-postgres.ps1 start
node scripts/portable-start.mjs besu
node scripts/portable-start.mjs matcher
node scripts/portable-start.mjs minio
pnpm --filter @edument/api start
pnpm --filter @edument/web start
```

`D:\EduMent` örnek proje yoludur; EDUMENT_NATIVE_ROOT değerini kendi proje klasörünüze göre ayarlayın. PostgreSQL paketinin Türkçe yol karakterlerinde sorun yaşadığı kurulumlarda klasörün Windows kısa yol adını kullanın. Standart Docker kurulumu bu kısa yola ihtiyaç duymaz.

PostgreSQL durdurma: `.\scripts\portable-postgres.ps1 stop`. Diğer taşınabilir hizmetlerin PID'leri `.runtime/*.pid`, günlükleri `.runtime/logs/` altındadır. Yalnızca bu projeye ait süreçleri durdurun; genel `taskkill /IM node.exe` kullanmayın.

MinIO doğrudan indirme adresi 410 döndüğünden `RELEASE.2025-04-22T22-12-26Z` kaynağı yerelde Go ile derlendi. Bu yol bir üretim dağıtım önerisi değildir. Docker akışı sabit imaj etiketini kullanır.
