# Bu Windows çalışma alanındaki taşınabilir servisler

Docker bulunmadığı için doğrulama sırasında `.runtime` altına yerel geliştirme araçları indirildi. Sistem hizmeti kurulmadı, sistem PATH'i değiştirilmedi. `.runtime` sürüm kontrolü dışında ve indirilen araçlar yeniden dağıtımın zorunlu parçası değildir.

**PostgreSQL'i doğrudan `postgres.exe` veya ayrılmış konsol süreçleriyle başlatmayın.** Bu ortamda alt süreçler görünür konsollar açıp konsol kapandıkça yeniden başlama döngüsüne girdi. Bunun yerine `scripts/portable-postgres.ps1` içindeki `pg_ctl` denetleyicisi ve `Start-Process -WindowStyle Hidden` kullanılır.

PowerShell:

```powershell
$env:BILSEM_NATIVE_ROOT='C:\Users\User\Desktop\BLSEMB~1'
.\scripts\portable-postgres.ps1 start
node scripts/portable-start.mjs besu
node scripts/portable-start.mjs matcher
node scripts/portable-start.mjs minio
pnpm --filter @bilsem/api start
pnpm --filter @bilsem/web start
```

`BLSEMB~1` bu makinedeki aynı proje klasörünün kısa Windows adıdır; başka makinede kopyalanmamalıdır. PostgreSQL paketinin Türkçe yol karakterlerinde hata vermesini önler. Standart Docker kurulumu bu kısa yola ihtiyaç duymaz.

PostgreSQL durdurma: `.\scripts\portable-postgres.ps1 stop`. Diğer taşınabilir hizmetlerin PID'leri `.runtime/*.pid`, günlükleri `.runtime/logs/` altındadır. Yalnızca bu projeye ait süreçleri durdurun; genel `taskkill /IM node.exe` kullanmayın.

MinIO doğrudan indirme adresi 410 döndüğünden `RELEASE.2025-04-22T22-12-26Z` kaynağı yerelde Go ile derlendi. Bu yol bir üretim dağıtım önerisi değildir. Docker akışı sabit imaj etiketini kullanır.
