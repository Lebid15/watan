# deploy.ps1
$server = "root@49.13.133.189"
$branch = "main"

Write-Host "Push changes to GitHub..."
$status = git status --porcelain
if (-not [string]::IsNullOrWhiteSpace($status)) {
	git add .
	$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
	git commit -m "auto deploy $ts"
	git push origin $branch
} else {
	Write-Host "No local changes to commit. Pushing skipped."
}

Write-Host "Connect to server and deploy..."
# سطر واحد على السيرفر لتفادي CRLF
# أضفنا nginx في up لإعادة تحميل الكونفيغ (راوت /api/me الداخلي)
$remote = "cd ~/watan && git pull origin $branch && docker compose build --no-cache backend frontend && docker compose up -d postgres redis backend frontend nginx && docker compose exec backend node dist/data-source.js migration:run"
ssh $server $remote

Write-Host "Deployment finished."
