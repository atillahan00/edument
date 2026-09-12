param([ValidateSet('start','stop')][string]$Action='start')
$ErrorActionPreference='Stop'
$taskRoot=if($env:BILSEM_NATIVE_ROOT){$env:BILSEM_NATIVE_ROOT}else{Split-Path -Parent $PSScriptRoot}
$taskPgCtl=Join-Path $taskRoot '.runtime/postgres/bin/pg_ctl.exe'
$taskPgData=Join-Path $taskRoot '.runtime/pg-data'
$taskLog=Join-Path $taskRoot '.runtime/logs/postgres.log'
$taskArguments=if($Action -eq 'start'){@('start','-D',$taskPgData,'-l',$taskLog,'-o','"-h 127.0.0.1 -p 5432"','-w','-s')}else{@('stop','-D',$taskPgData,'-m','fast','-w','-s')}
# pg_ctl owns daemon setup; every launcher window stays hidden.
$taskProcess=Start-Process -FilePath $taskPgCtl -ArgumentList $taskArguments -WindowStyle Hidden -PassThru
$taskProcess.WaitForExit()
if($taskProcess.ExitCode -ne 0){throw "PostgreSQL başlatma/durdurma başarısız: $($taskProcess.ExitCode)"}
Write-Output "PostgreSQL: $Action tamamlandı."
