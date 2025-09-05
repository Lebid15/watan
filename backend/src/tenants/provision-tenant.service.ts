import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tenant } from './tenant.entity';
import { TenantDomain } from './tenant-domain.entity';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { User } from '../user/user.entity';

@Injectable()
export class ProvisionTenantService {
  constructor(private readonly dataSource: DataSource) {}

  async provision(dto: ProvisionTenantDto) {
    return this.dataSource.transaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      const domainRepo = manager.getRepository(TenantDomain);
      const userRepo = manager.getRepository(User);

      const existingCode = await tenantRepo.findOne({ where: { code: dto.code } });
      if (existingCode) throw new BadRequestException('CODE_IN_USE');

      const existingHost = await domainRepo.findOne({ where: { domain: dto.host } });
      if (existingHost) throw new BadRequestException('HOST_IN_USE');

      const tenant = tenantRepo.create({ name: dto.name, code: dto.code, isActive: true });
      const savedTenant = await tenantRepo.save(tenant);

      const domain = domainRepo.create({
        tenantId: savedTenant.id,
        domain: dto.host,
        type: 'subdomain',
        isPrimary: true,
        isVerified: true,
      } as Partial<TenantDomain>);
      const savedDomain = await domainRepo.save(domain);

      let ownerUser: User | null = null;
      if (dto.ownerUserId) {
        ownerUser = await userRepo.findOne({ where: { id: dto.ownerUserId } as any });
        if (!ownerUser) throw new NotFoundException('OWNER_USER_NOT_FOUND');
        ownerUser.tenantId = savedTenant.id;
        await userRepo.save(ownerUser);
      }

      return { tenant: savedTenant, domain: savedDomain, ownerUser: ownerUser ? { id: ownerUser.id } : null };
    });
  }
}
