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
import { Patch } from '@nestjs/common';
import { ApiOperation, ApiBody } from '@nestjs/swagger';
import { ProductPackage } from '../products/product-package.entity';
import { PackagePrice } from '../products/package-price.entity';
import { PriceGroup } from '../products/price-group.entity';
import { DataSource } from 'typeorm';
import { SetUnitPriceOverrideDto, ToggleSupportsCounterDto, UpdateUnitPackageDto } from './dto/unit-pricing.dto';
import { isValidDec } from '../products/decimal.util';
import { PRICE_DECIMALS } from './unit-pricing.constants';
import { getPriceDecimals } from '../config/pricing.config';
import {
		DECIMAL_DYNAMIC_REGEX,
	ERR_SUPPORTS_COUNTER_REQUIRED,
	ERR_MISSING_TENANT,
	ERR_PRODUCT_NOT_FOUND,
	ERR_PACKAGE_NOT_FOUND,
	ERR_PRICE_GROUP_NOT_FOUND,
	ERR_PACKAGE_NOT_UNIT,
	ERR_PRODUCT_COUNTER_DISABLED,
	ERR_TENANT_MISMATCH,
	ERR_UNIT_PRICE_REQUIRED,
	ERR_UNIT_PRICE_INVALID,
	ERR_UNIT_NAME_REQUIRED,
	ERR_BASE_UNIT_REQUIRED,
	ERR_RANGE_INVALID,
	ERR_STEP_INVALID,
	ERR_PACKAGE_ID_REQUIRED,
} from './unit-pricing.constants';

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
			@InjectRepository(ProductPackage) private readonly packagesRepo: Repository<ProductPackage>,
			private readonly audit: AuditService,
			private readonly metrics: ProductImageMetricsService,
	private readonly webhooks: WebhooksService,
	private readonly thumbs: ThumbnailService,
	private readonly dataSource: DataSource,
		) {}

	private getTenantId(req: Request): string | undefined {
		return (req as any)?.tenant?.id || (req as any)?.user?.tenantId;
	}

	@Patch(':id/supports-counter')
	@ApiOperation({ summary: 'Toggle counter (unit) support for a product', description: 'Enables or disables unit (counter) pricing features on a product. Must be enabled before configuring any unit-type packages or setting unit price overrides.' })
	@ApiBody({ schema: { properties: { supportsCounter: { type: 'boolean', example: true } }, required: ['supportsCounter'] } })
	async toggleSupportsCounter(
		@Param('id') id: string,
		@Body() body: ToggleSupportsCounterDto,
		@Req() req: Request,
	) {
		const tenantId = this.getTenantId(req);
		if (!tenantId) throw new BadRequestException(ERR_MISSING_TENANT);
		if (typeof body?.supportsCounter !== 'boolean') throw new BadRequestException(ERR_SUPPORTS_COUNTER_REQUIRED);
		const product = await this.productsRepo.findOne({ where: { id, tenantId } as any });
		if (!product) throw new NotFoundException(ERR_PRODUCT_NOT_FOUND);
		(product as any).supportsCounter = body.supportsCounter;
		await this.productsRepo.save(product);
		await this.audit.log('product.supportsCounter.toggle', {
			actorUserId: (req as any)?.user?.id ?? null,
			targetTenantId: tenantId,
			meta: { productId: product.id, supportsCounter: body.supportsCounter },
		});
		return { ok: true, id: product.id, supportsCounter: body.supportsCounter };
	}

		@Put('price-groups/:groupId/package-prices/:packageId/unit')
		@ApiOperation({ summary: 'Set unit price override for a price group/package', description: 'Stores a price-per-unit override specific to a price group. Requires: product.supportsCounter = true and package.type = unit.' })
		@ApiBody({ schema: { properties: { unitPrice: { type: 'string', example: '0.1250', description: 'Positive decimal price per single unit (scale up to 4). Will be rounded to 4 decimals.' } }, required: ['unitPrice'] } })
		async setUnitPriceOverride(
			@Param('groupId') groupId: string,
			@Param('packageId') packageId: string,
			@Body() body: SetUnitPriceOverrideDto,
			@Req() req: Request,
		) {
			const tenantId = this.getTenantId(req);
			if (!tenantId) throw new BadRequestException(ERR_MISSING_TENANT);
			const packagePricesRepo = this.dataSource.getRepository(PackagePrice);
			const priceGroupsRepo = this.dataSource.getRepository(PriceGroup);
			const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any, relations: ['product', 'prices', 'prices.priceGroup'] });
			if (!pkg) throw new NotFoundException(ERR_PACKAGE_NOT_FOUND);
			if (pkg.type !== 'unit') throw new BadRequestException(ERR_PACKAGE_NOT_UNIT);
			if (!pkg.product?.supportsCounter) throw new BadRequestException(ERR_PRODUCT_COUNTER_DISABLED);
			if (String((pkg as any).tenantId) !== tenantId || String(pkg.product?.tenantId) !== tenantId) throw new BadRequestException(ERR_TENANT_MISMATCH);
			const group = await priceGroupsRepo.findOne({ where: { id: groupId, tenantId } as any });
			if (!group) throw new NotFoundException(ERR_PRICE_GROUP_NOT_FOUND);
			const raw = String(body.unitPrice).trim();
			if (!isValidDec(raw)) throw new BadRequestException(ERR_UNIT_PRICE_INVALID);
			const num = Number(raw);
			if (!(num > 0)) throw new BadRequestException(ERR_UNIT_PRICE_INVALID);
			const scaled = Number(num.toFixed(getPriceDecimals()));
			let row = (pkg.prices || []).find(p => p.priceGroup?.id === group.id);
			if (!row) {
				row = packagePricesRepo.create({ tenantId, package: pkg, priceGroup: group, price: 0, unitPrice: scaled });
			} else {
				(row as any).unitPrice = scaled;
			}
			await packagePricesRepo.save(row);
			await this.audit.log('package.unitPrice.override.set', {
				actorUserId: (req as any)?.user?.id ?? null,
				targetTenantId: tenantId,
				meta: { packageId: pkg.id, groupId: group.id, unitPrice: scaled }
			});
			return { ok: true, packageId: pkg.id, groupId: group.id, unitPrice: scaled.toFixed(4) };
		}

		@Delete('price-groups/:groupId/package-prices/:packageId/unit')
		@ApiOperation({ summary: 'Remove unit price override for a price group/package', description: 'Nullifies the stored unitPrice override (does not delete the base row). Subsequent pricing uses baseUnitPrice from the package.' })
		async deleteUnitPriceOverride(
			@Param('groupId') groupId: string,
			@Param('packageId') packageId: string,
			@Req() req: Request,
		) {
			const tenantId = this.getTenantId(req);
			if (!tenantId) throw new BadRequestException(ERR_MISSING_TENANT);
			const packagePricesRepo = this.dataSource.getRepository(PackagePrice);
			const priceGroupsRepo = this.dataSource.getRepository(PriceGroup);
			const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any, relations: ['product', 'prices', 'prices.priceGroup'] });
			if (!pkg) throw new NotFoundException(ERR_PACKAGE_NOT_FOUND);
			if (pkg.type !== 'unit') throw new BadRequestException(ERR_PACKAGE_NOT_UNIT);
			if (!pkg.product?.supportsCounter) throw new BadRequestException(ERR_PRODUCT_COUNTER_DISABLED);
			if (String((pkg as any).tenantId) !== tenantId || String(pkg.product?.tenantId) !== tenantId) throw new BadRequestException(ERR_TENANT_MISMATCH);
			const group = await priceGroupsRepo.findOne({ where: { id: groupId, tenantId } as any });
			if (!group) throw new NotFoundException(ERR_PRICE_GROUP_NOT_FOUND);
			const row = (pkg.prices || []).find(p => p.priceGroup?.id === group.id);
			if (!row) return { ok: true, removed: false };
			(row as any).unitPrice = null;
			await packagePricesRepo.save(row);
			await this.audit.log('package.unitPrice.override.delete', {
				actorUserId: (req as any)?.user?.id ?? null,
				targetTenantId: tenantId,
				meta: { packageId: pkg.id, groupId: group.id }
			});
			return { ok: true, removed: true };
		}

		@Get('price-groups/:groupId/package-prices')
		@ApiOperation({ summary: 'Get price group package price including unitPrice (if unit package)', description: 'Fetches pricing row for a package within a given price group. Includes unit metadata and unitPrice override when applicable.' })
		async getPriceGroupPackagePrice(
			@Param('groupId') groupId: string,
			@Query('packageId') packageId: string,
			@Req() req: Request,
		) {
			if (!packageId) throw new BadRequestException(ERR_PACKAGE_ID_REQUIRED);
			const tenantId = this.getTenantId(req);
			if (!tenantId) throw new BadRequestException(ERR_MISSING_TENANT);
			const priceGroupsRepo = this.dataSource.getRepository(PriceGroup);
			const group = await priceGroupsRepo.findOne({ where: { id: groupId, tenantId } as any });
			if (!group) throw new NotFoundException(ERR_PRICE_GROUP_NOT_FOUND);
			const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any, relations: ['product', 'prices', 'prices.priceGroup'] });
			if (!pkg) throw new NotFoundException(ERR_PACKAGE_NOT_FOUND);
			if (String((pkg as any).tenantId) !== tenantId || String(pkg.product?.tenantId) !== tenantId) throw new BadRequestException(ERR_TENANT_MISMATCH);
			// find or create price row (do not persist if missing)
			const row = (pkg.prices || []).find(p => p.priceGroup?.id === group.id);
			return {
				ok: true,
				groupId: group.id,
				groupName: group.name,
				packageId: pkg.id,
				priceId: row?.id || null,
				price: row ? Number(row.price) || 0 : 0,
				// unit meta always returned for convenience
				packageType: pkg.type,
				supportsCounter: !!pkg.product?.supportsCounter,
				unitName: (pkg as any).unitName || null,
				unitCode: (pkg as any).unitCode || null,
				minUnits: (pkg as any).minUnits ?? null,
				maxUnits: (pkg as any).maxUnits ?? null,
				step: (pkg as any).step ?? null,
				baseUnitPrice: (pkg as any).baseUnitPrice ?? null,
				unitPrice: pkg.type === 'unit' && pkg.product?.supportsCounter ? (row && (row as any).unitPrice != null ? Number((row as any).unitPrice).toFixed(getPriceDecimals()) : null) : null,
			};
		}

		@Patch('packages/:id/unit')
		@ApiOperation({ summary: 'Update unit (counter) fields for a unit-type package', description: 'Defines the measuring unit metadata and base price-per-unit. The baseUnitPrice is used when no price-group override (unitPrice) exists.' })
		@ApiBody({ schema: { properties: { unitName: { type: 'string', example: 'Message' }, unitCode: { type: 'string', example: 'MSG' }, minUnits: { type: 'string', example: '10', description: 'Optional minimum allowed quantity (>=0) scale<=4' }, maxUnits: { type: 'string', example: '1000', description: 'Optional maximum allowed quantity (>= minUnits) scale<=4' }, step: { type: 'string', example: '1', description: 'Optional increment step (>0) scale<=4' }, baseUnitPrice: { type: 'string', example: '0.0500', description: 'Positive decimal (scale<=4). Rounded to 4 decimals.' } }, required: ['unitName','baseUnitPrice'] } })
		async updateUnitPackage(
			@Param('id') id: string,
			@Body() body: UpdateUnitPackageDto,
			@Req() req: Request,
		) {
			const tenantId = this.getTenantId(req);
			if (!tenantId) throw new BadRequestException(ERR_MISSING_TENANT);
			const pkg = await this.packagesRepo.findOne({ where: { id } as any, relations: ['product'] });
			if (!pkg) throw new NotFoundException(ERR_PACKAGE_NOT_FOUND);
			if (String((pkg as any).tenantId) !== tenantId || String(pkg.product?.tenantId) !== tenantId) throw new BadRequestException(ERR_TENANT_MISMATCH);
			if (pkg.type !== 'unit') throw new BadRequestException(ERR_PACKAGE_NOT_UNIT);
			if (!pkg.product?.supportsCounter) throw new BadRequestException(ERR_PRODUCT_COUNTER_DISABLED);
			if (!body.unitName || !body.unitName.trim()) throw new BadRequestException(ERR_UNIT_NAME_REQUIRED);

			function parseScaled(name: string, v: string | undefined): number | null {
				if (v == null || v === '') return null;
				const s = String(v).trim();
				if (!isValidDec(s)) throw new BadRequestException(name + '_INVALID');
				const num = Number(s);
				if (!Number.isFinite(num) || num < 0) throw new BadRequestException(name + '_INVALID');
				return Number(num.toFixed(getPriceDecimals()));
			}
			const minUnits = parseScaled('minUnits', body.minUnits);
			const maxUnits = parseScaled('maxUnits', body.maxUnits);
			const step = parseScaled('step', body.step);
			const baseUnitPrice = parseScaled('baseUnitPrice', body.baseUnitPrice);
			if (baseUnitPrice == null || baseUnitPrice <= 0) throw new BadRequestException(ERR_BASE_UNIT_REQUIRED);
			if (minUnits != null && maxUnits != null && maxUnits < minUnits) throw new BadRequestException(ERR_RANGE_INVALID);
			if (step != null && step <= 0) throw new BadRequestException(ERR_STEP_INVALID);

			(pkg as any).unitName = body.unitName.trim();
			(pkg as any).unitCode = body.unitCode ? String(body.unitCode).trim() : null;
			(pkg as any).minUnits = minUnits;
			(pkg as any).maxUnits = maxUnits;
			(pkg as any).step = step;
			(pkg as any).baseUnitPrice = baseUnitPrice;
			await this.packagesRepo.save(pkg);
			await this.audit.log('package.unit.update', {
				actorUserId: (req as any)?.user?.id ?? null,
				targetTenantId: tenantId,
				meta: { packageId: pkg.id, productId: pkg.product?.id, unitName: (pkg as any).unitName }
			});
			return { ok: true, id: pkg.id, productId: pkg.product?.id, unitName: (pkg as any).unitName, baseUnitPrice: (pkg as any).baseUnitPrice };
		}

	@Put(':id/image/custom')
	async setCustomImage(
		@Param('id') id: string,
		@Body() body: { customImageUrl?: string; customAltText?: string | null },
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
		// Catalog usage flag removed
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
				meta: { productId: product.id, customImageUrl: (product as any).customImageUrl, customAltText: (product as any).customAltText },
			});
			return { ok: true, id: product.id, customImageUrl: (product as any).customImageUrl };
	}

	// Catalog image toggle removed

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
		// Removed catalog fallback flag
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
			return { ok: true, id: product.id, customImageUrl: null };
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

	// Batch toggle catalog image feature removed

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
			const effective = p.customImageUrl || p.imageUrl || null;
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
