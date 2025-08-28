# deploy.ps1

Write-Host "Push changes to GitHub..."
git add .
git commit -m "auto deploy"
git push origin feat/phase8-frontend-roles-and-catalog

Write-Host "Connect to server and deploy..."
ssh root@syr1-vps @"
  cd ~/watan
  git pull origin feat/phase8-frontend-roles-and-catalog
  docker compose build backend frontend
  docker compose up -d backend frontend
  docker compose exec backend npx typeorm migration:run -d dist/data-source.js
"@

Write-Host "Deployment finished."
