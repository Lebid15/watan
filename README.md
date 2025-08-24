## Local Development (Database & Redis)

Use `docker-compose.dev.yml` to spin up Postgres + Redis (and optionally backend) with known credentials:

```bash
docker compose -f docker-compose.dev.yml up -d db redis

# Or include backend (hot reload via volume mount):
docker compose -f docker-compose.dev.yml up -d
```

Environment settings baked into this dev stack:
- Postgres: postgres/postgres, DB: watan
- Redis: port 6379
- Backend dev URL: http://localhost:3000

If you prefer to run backend outside Docker, keep the services up and set in `backend/.env.local`:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/watan
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=local-dev-secret
PUBLIC_TENANT_BASE_DOMAIN=localhost
```

Then from `backend/`:
```bash
npm run start:dev
```

To stop and remove dev containers:
```bash
docker compose -f docker-compose.dev.yml down
```

To reset Postgres data:
```bash
docker compose -f docker-compose.dev.yml down -v
```

Production deployment uses the main `docker-compose.yml` (without local DB/Redis). Add external DATABASE_URL & REDIS_URL in the root `.env` for GitHub Actions or VPS deploy.