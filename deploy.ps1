# deploy.ps1
$server = "root@49.13.133.189"
$branch = "feat/phase8-frontend-roles-and-catalog"

Write-Host "Push changes to GitHub..."
git add .
git commit -m "auto deploy"
git push origin $branch

Write-Host "Connect to server and deploy..."
# سطر واحد على السيرفر لتفادي CRLF
$remote = "cd ~/watan && git pull origin $branch && docker compose build backend frontend && docker compose up -d backend frontend && docker compose exec backend npx typeorm migration:run -d dist/data-source.js"
$remote = "cd ~/watan && git pull origin $branch && docker compose build --no-cache backend frontend && docker compose up -d backend frontend && docker compose exec backend node dist/data-source.js migration:run"
ssh $server $remote

Write-Host "Deployment finished."
