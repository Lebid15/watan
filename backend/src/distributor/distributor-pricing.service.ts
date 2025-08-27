import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributorPriceGroup, DistributorPackagePrice, DistributorUserPriceGroup } from './distributor-pricing.entities';
import { isFeatureEnabled } from '../common/feature-flags';
import { ProductPackage } from '../products/product-package.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class DistributorPricingService {
  constructor(
    @InjectRepository(DistributorPriceGroup) private readonly groupsRepo: Repository<DistributorPriceGroup>,
    @InjectRepository(DistributorPackagePrice) private readonly pricesRepo: Repository<DistributorPackagePrice>,
    @InjectRepository(DistributorUserPriceGroup) private readonly userGroupsRepo: Repository<DistributorUserPriceGroup>,
    @InjectRepository(ProductPackage) private readonly pkgRepo: Repository<ProductPackage>,
    private readonly productsService: ProductsService,
  ) {}

  private ensureFlag() { if (!isFeatureEnabled('catalogLinking')) throw new ForbiddenException('Feature disabled'); }

  async createGroup(tenantId: string, distributorUserId: string, name: string) {
    this.ensureFlag();
    if (!name?.trim()) throw new BadRequestException('Name required');
    const exists = await this.groupsRepo.findOne({ where: { tenantId, distributorUserId, name: name.trim() } as any });
    if (exists) return exists;
    return this.groupsRepo.save(this.groupsRepo.create({ tenantId, distributorUserId, name: name.trim(), isActive: true }));
  }

  async listGroups(tenantId: string, distributorUserId: string) {
    this.ensureFlag();
    return this.groupsRepo.find({ where: { tenantId, distributorUserId } as any, order: { name: 'ASC' } });
  }

  async attachUser(distributorPriceGroupId: string, userId: string) {
    this.ensureFlag();
    return this.userGroupsRepo.save(this.userGroupsRepo.create({ distributorPriceGroupId, userId }));
  }

  async detachUser(distributorPriceGroupId: string, userId: string) {
    this.ensureFlag();
    await this.userGroupsRepo.delete({ distributorPriceGroupId, userId } as any);
    return { ok: true };
  }

  async setPackagePrice(tenantId: string, distributorUserId: string, distributorPriceGroupId: string, packageId: string, priceUSD: number) {
    this.ensureFlag();
    const pkg = await this.pkgRepo.findOne({ where: { id: packageId, tenantId } as any });
    if (!pkg) throw new NotFoundException('Package not found');
    let row = await this.pricesRepo.findOne({ where: { distributorUserId, distributorPriceGroupId, packageId } as any });
    if (!row) {
      row = this.pricesRepo.create({ tenantId, distributorUserId, distributorPriceGroupId, packageId, priceUSD });
    } else {
      row.priceUSD = priceUSD;
    }
    return this.pricesRepo.save(row);
  }

  async listPricingTable(tenantId: string, distributorUserId: string) {
    this.ensureFlag();
    // Basic table: each active package with its capital and all group prices (USD only for now; conversion handled at presentation layer elsewhere)
    const packages = await this.pkgRepo.find({ where: { tenantId, isActive: true } as any, take: 2000 });
    const groups = await this.groupsRepo.find({ where: { tenantId, distributorUserId } as any });
    const prices = await this.pricesRepo.find({ where: { tenantId, distributorUserId } as any });
    return {
      groups: groups.map(g => ({ id: g.id, name: g.name })),
      items: packages.map(p => ({
        packageId: p.id,
        name: p.name,
        capitalUSD: Number(p.capital)||0,
        groupPrices: groups.map(g => {
          const pr = prices.find(r => r.distributorPriceGroupId === g.id && r.packageId === p.id);
          return { groupId: g.id, priceUSD: pr ? Number(pr.priceUSD) : 0 };
        }),
      })),
    };
  }
}
