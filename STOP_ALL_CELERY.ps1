# Kill all Celery processes
Write-Host "Stopping all Celery processes..." -ForegroundColor Yellow

Get-WmiObject Win32_Process -Filter "name = 'python.exe'" | Where-Object { $_.CommandLine -like "*celery*" } | ForEach-Object {
    Write-Host "  Stopping PID $($_.ProcessId) - $($_.CommandLine.Substring(0, [Math]::Min(80, $_.CommandLine.Length)))" -ForegroundColor Gray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

$remaining = Get-WmiObject Win32_Process -Filter "name = 'python.exe'" | Where-Object { $_.CommandLine -like "*celery*" } | Measure-Object | Select-Object -ExpandProperty Count

if ($remaining -eq 0) {
    Write-Host "✅ All Celery processes stopped successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️ $remaining Celery processes still running!" -ForegroundColor Red
}
