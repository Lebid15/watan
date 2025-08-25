<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

---

## Product Image Fallback (Tenant Products)

This backend now supports a flexible image sourcing model for tenant products.

### Fields
Product entity includes:
- `customImageUrl` (nullable): tenant-specific image (highest priority when `useCatalogImage=false`).
- `useCatalogImage` (boolean, default true): whether to use shared catalog image.
- `catalogImageUrl` (nullable): backfilled copy of legacy `imageUrl` representing catalog reference image.
- Legacy `imageUrl`: kept temporarily for backward compatibility (will be dropped after frontend migration).

### Effective Image Resolution
1. If `customImageUrl` is set AND `useCatalogImage` is false → effective image = `customImageUrl` (source = `custom`).
2. Else if `catalogImageUrl` (or legacy `imageUrl`) exists → effective image = that value (source = `catalog`).
3. Else → null.

API responses (`/api/products`, `/api/products/:id`, user variants) include:
```
imageUrl         // effective
imageSource      // 'custom' | 'catalog' | null
useCatalogImage  // boolean
hasCustomImage   // boolean
customImageUrl   // raw custom URL or null
```

### Admin Endpoints
```
PUT    /api/admin/products/:id/image/custom   { customImageUrl?, useCatalogImage? }
PUT    /api/admin/products/:id/image/catalog  { useCatalogImage }
DELETE /api/admin/products/:id/image/custom   // clears custom and reverts to catalog
```
All require role: developer or admin, JWT auth, and feature flag enabled.

### Feature Flag
Located in `src/common/feature-flags.ts` (`productImageFallback: true`). Disable to revert to legacy behavior (only effective imageUrl exposed).

### Migrations
1. `AddProductImageFallbackFields` – adds `customImageUrl`, `useCatalogImage` and backfills legacy data.
2. `AddCatalogImageUrl` – introduces `catalogImageUrl` and copies legacy `imageUrl` for catalog-backed rows.

### Planned Cleanup
After frontend fully uses new fields:
- Drop legacy `imageUrl` column.
- Optionally rename `catalogImageUrl` -> `imageUrl` (or keep as-is for clarity).
Track usage metrics before removal.

### Audit Events
Events emitted via `AuditService`:
- `product.image.custom.set`
- `product.image.catalog.toggle`
- `product.image.custom.clear`

Each includes `productId`, tenant context, and relevant state.

### Metrics Persistence
Periodic snapshots of image usage (custom vs catalog vs missing) are persisted in the `product_image_metrics_snapshot` table via:
- Cron scheduler (every 12 hours) using `ProductImageMetricsScheduler`.
- Manual script: `npm run metrics:product-images`.

Snapshot schema fields:
```
id, createdAt, customCount, catalogCount, missingCount
```
Use these for trend analysis (e.g., rate of custom adoption or remaining missing images). Latest 5 snapshots are printed by the script.
Automatic retention cleanup keeps only the last 30 days (daily job at 02:00). Adjust in `product-image-metrics.scheduler.ts`.

#### Metrics Endpoint Security
`/metrics` supports optional token protection. Set environment variable `METRICS_TOKEN=yourSecret` and supply either:
- Header: `Authorization: Bearer yourSecret`
- Or query param: `/metrics?token=yourSecret`
If `METRICS_TOKEN` is unset the endpoint is public (intended for internal networks only).

#### Admin Metrics APIs
Operational image metrics:
- `GET /api/admin/products/image-metrics/latest?limit=20` recent snapshots.
- `GET /api/admin/products/image-metrics/delta` day-over-day diff (returns null if insufficient history).

### Alt Text Accessibility
Additional columns support accessible descriptions:
- `catalogAltText` – optional default alt text derived from catalog.
- `customAltText` – tenant override / custom description.

Exposure:
All product listing/detail endpoints include both fields so the frontend can choose precedence (e.g. custom first, then catalog, else placeholder).

### Thumbnails
Persistent derivative thumbnail columns:
- `thumbSmallUrl` (≈64x64)
- `thumbMediumUrl` (≈200x200)
- `thumbLargeUrl` (≈400x400)

Generation strategy:
1. On custom image upload/change (admin `PUT /api/admin/products/:id/image/custom`) thumbnails are generated if URL looks like Cloudinary (`/upload/`); otherwise original URL is copied into each size.
2. Manual regeneration endpoint `POST /api/admin/products/images/regenerate-thumbnails` body: `{ limit?: number=100, force?: boolean, ids?: string[] }` to backfill or force refresh.
3. Scheduled backfill (`ThumbnailScheduler`) runs every 6 hours to fill any missing variants (up to 2000 products per pass).

Environment (optional) – no dedicated vars required; relies on Cloudinary public transformation semantics.

### Webhooks
Outbound webhooks fire (fire-and-forget with retries) if corresponding environment URLs are set:
- `WEBHOOK_CATALOG_IMAGE_CHANGED_URL` on catalog product image change (payload includes `event=catalog.product.image.changed`).
- `WEBHOOK_PRODUCT_IMAGE_CUSTOM_SET_URL` on custom image set (`event=product.image.custom.set`).

#### Security (HMAC Signing)
If you set `WEBHOOK_SECRET`, each webhook request includes:
```
X-Webhook-Timestamp: <epoch_ms>
X-Webhook-Signature: t=<epoch_ms>,v1=<hex_sha256_hmac>
```
Signature algorithm:
`hex_sha256_hmac = HMAC_SHA256(secret, "<epoch_ms>." + JSON.stringify(body))`

Receiver verification steps:
1. Parse headers, extract `t` and `v1`.
2. Ensure `abs(now - t) < 5 minutes` (replay window).
3. Recompute HMAC over `<t>.<raw body>` with the shared secret.
4. Timing-safe compare to `v1`.

Rotate secret by updating `WEBHOOK_SECRET` (old in parallel if needed via accept-list until cutover).

Payload example:
```json
{
  "event": "product.image.custom.set",
  "productId": "...",
  "tenantId": "...",
  "customImageUrl": "https://res.cloudinary.com/...",
  "at": "2025-08-25T20:40:00.000Z"
}
```

### Adoption Dashboard (Frontend)
Admin UI page `/admin/products/image-adoption` visualizes:
- Latest counts (custom / catalog / missing) with percentages.
- Day-over-day diffs (color badges) if sufficient historical snapshots.
- Recent snapshot table.
Auto-refreshes every 60s.

### Regeneration Workflow Summary
| Action | Trigger | Result |
|--------|---------|--------|
| Custom image set | Admin PUT custom endpoint | Generates & stores thumbnails, emits webhook |
| Custom image cleared | Admin DELETE custom | Clears thumbnail columns (will be re-generated from catalog by scheduler/manual) |
| Manual regenerate | POST regenerate-thumbnails | Fills or forces thumbnails for selected products |
| Periodic backfill | Cron every 6h | Ensures any missed products receive thumbnails |

### Future Hardening Ideas
| Area | Suggestion |
|------|------------|
| Queue | Offload generation to a job queue (BullMQ) for large batches |
| Image validation | Head request to ensure 200 & content-type image/* before persisting |
| Signed URLs | Support short-lived signed URLs for private assets |
| Purge stale | Detect & purge thumbnails when base URL domain changes |
| Webhooks | Enforce signature verification & replay window on receiver |


