import { Controller, Get, Patch, Post, Param, Body, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { FinalRoles } from '../common/authz/roles';
import { isFeatureEnabled } from '../common/feature-flags';

@Controller('tenant/distributor/users')
@FinalRoles('instance_owner')
export class DistributorUsersController {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  private ensureFlag() { if (!isFeatureEnabled('catalogLinking')) throw new BadRequestException('Feature disabled'); }

  @Get('list')
  async list(@Req() req: any) {
    this.ensureFlag();
    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    const role = req?.user?.roleFinal || req?.user?.role;
    const distributorId = role === 'instance_owner' ? req.user.id : (req.query.distributorId as string) || req.user.id;
    const rows = await this.usersRepo.find({ where: { tenantId, parentUserId: distributorId } as any });
    return { items: rows.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, priceGroupId: u.price_group_id })) };
  }

  @Patch(':id/reset-password')
  async resetPassword(@Req() req: any, @Param('id') id: string, @Body('newPassword') newPassword: string) {
    this.ensureFlag();
    if (!newPassword || newPassword.length < 6) throw new BadRequestException('Weak password');
    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    const role = req?.user?.roleFinal || req?.user?.role;
    const target = await this.usersRepo.findOne({ where: { id } as any });
    if (!target) throw new NotFoundException('User not found');
    if (target.tenantId !== tenantId) throw new BadRequestException('Cross-tenant');
    if (role === 'instance_owner' && target.parentUserId !== req.user.id) throw new BadRequestException('Out of scope');
    target.password = newPassword; // TODO: hash in real implementation
    await this.usersRepo.save(target);
    return { ok: true };
  }

  @Post(':id/assign-price-group')
  async assignPriceGroup(@Req() req: any, @Param('id') id: string, @Body('priceGroupId') priceGroupId: string) {
    this.ensureFlag();
    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    const role = req?.user?.roleFinal || req?.user?.role;
    const target = await this.usersRepo.findOne({ where: { id } as any });
    if (!target) throw new NotFoundException('User not found');
    if (target.tenantId !== tenantId) throw new BadRequestException('Cross-tenant');
    if (role === 'instance_owner' && target.parentUserId !== req.user.id) throw new BadRequestException('Out of scope');
    target.price_group_id = priceGroupId;
    await this.usersRepo.save(target);
    return { ok: true };
  }
}
