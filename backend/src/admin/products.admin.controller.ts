import { Body, Controller, Param, Post, Put, Delete, NotFoundException, BadRequestException, Req, UseGuards, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { Product } from '../products/product.entity';
import { AuditService } from '../audit/audit.service';
import { ProductImageMetricsService } from '../products/product-image-metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { isFeatureEnabled } from '../common/feature-flags';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ThumbnailService } from '../products/thumbnail.service';

/**
 * Admin (tenant) product image fallback management.
 * Developer/Admin roles.
 */
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEVELOPER, UserRole.ADMIN)
export class ProductsAdminController {
		constructor(
			@InjectRepository(Product) private readonly productsRepo: Repository<Product>,
			private readonly audit: AuditService,
			private readonly metrics: ProductImageMetricsService,
	private readonly webhooks: WebhooksService,
	private readonly thumbs: ThumbnailService,
		) {}

	private getTenantId(req: Request): string | undefined {
		return (req as any)?.tenant?.id || (req as any)?.user?.tenantId;
	}

	@Put(':id/image/custom')
	async setCustomImage(
		@Param('id') id: string,
		@Body() body: { customImageUrl?: string; useCatalogImage?: boolean; customAltText?: string | null; catalogAltText?: string | null },
		@Req() req: Request,
	) {
		if (!isFeatureEnabled('productImageFallback')) {
			throw new BadRequestException('Feature disabled');
		}
		const tenantId = this.getTenantId(req);
		if (!tenantId) throw new BadRequestException('Missing tenant context');
		const product = await this.productsRepo.findOne({ where: { id, tenantId } as any });
		if (!product) throw new NotFoundException('Product not found');
		const prevCustom = (product as any).customImageUrl || null;
		(product as any).customImageUrl = body?.customImageUrl ?? null;
		if (body.customAltText !== undefined) (product as any).customAltText = body.customAltText;
		if (body.catalogAltText !== undefined) (product as any).catalogAltText = body.catalogAltText;
		if (body.useCatalogImage !== undefined) {
			(product as any).useCatalogImage = !!body.useCatalogImage;
		} else if (body.customImageUrl) {
			(product as any).useCatalogImage = false;
		}
			// Generate thumbnails if custom image changed
			if ((product as any).customImageUrl && prevCustom !== (product as any).customImageUrl) {
				const vars = this.thumbs.generate((product as any).customImageUrl);
				(product as any).thumbSmallUrl = vars.small;
				(product as any).thumbMediumUrl = vars.medium;
				(product as any).thumbLargeUrl = vars.large;
			}
			await this.productsRepo.save(product);
      // Fire a lightweight webhook to signal a new custom image (thumbnail generator could subscribe)
      if ((product as any).customImageUrl && process.env.WEBHOOK_PRODUCT_IMAGE_CUSTOM_SET_URL) {
        this.webhooks.postJson(process.env.WEBHOOK_PRODUCT_IMAGE_CUSTOM_SET_URL, {
          event: 'product.image.custom.set',
          productId: product.id,
          tenantId,
          customImageUrl: (product as any).customImageUrl,
          at: new Date().toISOString(),
        }).catch(()=>{});
      }
			await this.audit.log('product.image.custom.set', {
				actorUserId: (req as any)?.user?.id ?? null,
				targetTenantId: tenantId,
				meta: { productId: product.id, customImageUrl: (product as any).customImageUrl, useCatalogImage: (product as any).useCatalogImage, customAltText: (product as any).customAltText, catalogAltText: (product as any).catalogAltText },
			});
			return { ok: true, id: product.id, customImageUrl: (product as any).customImageUrl, useCatalogImage: (product as any).useCatalogImage };
	}

	@Put(':id/image/catalog')
	async toggleCatalogImage(
		@Param('id') id: string,
		@Body() body: { useCatalogImage: boolean },
		@Req() req: Request,
	) {
		if (!isFeatureEnabled('productImageFallback')) {
			throw new BadRequestException('Feature disabled');
		}
		const tenantId = this.getTenantId(req);
		if (!tenantId) throw new BadRequestException('Missing tenant context');
		const product = await this.productsRepo.findOne({ where: { id, tenantId } as any });
		if (!product) throw new NotFoundException('Product not found');
		(product as any).useCatalogImage = !!body.useCatalogImage;
			await this.productsRepo.save(product);
			await this.audit.log('product.image.catalog.toggle', {
				actorUserId: (req as any)?.user?.id ?? null,
				targetTenantId: tenantId,
				meta: { productId: product.id, useCatalogImage: (product as any).useCatalogImage },
			});
			return { ok: true, id: product.id, useCatalogImage: (product as any).useCatalogImage };
	}

	@Delete(':id/image/custom')
	async clearCustomImage(@Param('id') id: string, @Req() req: Request) {
		if (!isFeatureEnabled('productImageFallback')) {
			throw new BadRequestException('Feature disabled');
		}
		const tenantId = this.getTenantId(req);
		if (!tenantId) throw new BadRequestException('Missing tenant context');
		const product = await this.productsRepo.findOne({ where: { id, tenantId } as any });
		if (!product) throw new NotFoundException('Product not found');
		(product as any).customImageUrl = null;
		(product as any).useCatalogImage = true; // fallback to catalog
		// Clear thumbnails so they can be regenerated from catalog if needed
		(product as any).thumbSmallUrl = null;
		(product as any).thumbMediumUrl = null;
		(product as any).thumbLargeUrl = null;
		await this.productsRepo.save(product);
			await this.audit.log('product.image.custom.clear', {
				actorUserId: (req as any)?.user?.id ?? null,
				targetTenantId: tenantId,
				meta: { productId: product.id },
			});
			return { ok: true, id: product.id, customImageUrl: null, useCatalogImage: true };
	}

	// Metrics: latest product image snapshots (developer/admin). Not feature-flag gated (operational visibility).
	@Get('image-metrics/latest')
	async latestImageMetrics(@Query('limit') limit = '10') {
		const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
		const rows = await this.metrics.latest(take);
		return {
			ok: true,
			rows: rows.map(r => ({
				createdAt: r.createdAt,
				custom: r.customCount,
				catalog: r.catalogCount,
				missing: r.missingCount,
			})),
		};
	}

	@Get('image-metrics/delta')
	async imageMetricsDelta() {
		const delta = await this.metrics.dayOverDayDelta();
		return { ok: true, delta };
	}

	@Post('image/batch-toggle')
	async batchToggleCatalog(
		@Body() body: { ids: string[]; useCatalogImage: boolean },
		@Req() req: Request,
	) {
		if (!isFeatureEnabled('productImageFallback')) {
			throw new BadRequestException('Feature disabled');
		}
		if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
			throw new BadRequestException('ids required');
		}
		const tenantId = this.getTenantId(req);
		if (!tenantId) throw new BadRequestException('Missing tenant context');
		const ids = [...new Set(body.ids.map(String))];
		await this.productsRepo.update({ id: ids as any, tenantId } as any, { useCatalogImage: !!body.useCatalogImage } as any);
		await this.audit.log('product.image.catalog.batchToggle', {
			actorUserId: (req as any)?.user?.id ?? null,
			targetTenantId: tenantId,
			meta: { ids, useCatalogImage: !!body.useCatalogImage },
		});
		return { ok: true, ids, useCatalogImage: !!body.useCatalogImage };
	}

	/** Regenerate thumbnails for products missing them (or force). */
	@Post('images/regenerate-thumbnails')
	async regenerateThumbs(
		@Body() body: { limit?: number; force?: boolean; ids?: string[] },
		@Req() req: Request,
	) {
		const tenantId = this.getTenantId(req);
		if (!tenantId) throw new BadRequestException('Missing tenant context');
		const limit = Math.min(Math.max(Number(body?.limit ?? 100), 1), 500);
		const ids: string[] | undefined = Array.isArray(body?.ids) && body.ids.length ? body.ids.map(String) : undefined;
		const where: any = { tenantId };
		if (ids) where.id = ids as any;
		const candidates = await this.productsRepo.find({ where, take: limit });
		let processed = 0;
		for (const p of candidates as any[]) {
			const effective = p.customImageUrl && p.useCatalogImage === false ? p.customImageUrl : p.catalogImageUrl;
			if (!effective) continue;
			const needs = body?.force || !p.thumbSmallUrl || !p.thumbMediumUrl || !p.thumbLargeUrl;
			if (!needs) continue;
			const vars = this.thumbs.generate(effective);
			p.thumbSmallUrl = vars.small;
			p.thumbMediumUrl = vars.medium;
			p.thumbLargeUrl = vars.large;
			await this.productsRepo.save(p);
			processed++;
		}
		await this.audit.log('product.image.thumbs.regenerate', {
			actorUserId: (req as any)?.user?.id ?? null,
			targetTenantId: tenantId,
			meta: { limit, processed, ids: ids ?? null, force: !!body?.force },
		});
		return { ok: true, processed, totalScanned: candidates.length };
	}
}
