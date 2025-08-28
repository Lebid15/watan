import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { ProductOrder } from '../products/product-order.entity';
import { Deposit } from '../payments/deposit.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminCountsController {
  constructor(
    @InjectRepository(ProductOrder) private readonly ordersRepo: Repository<ProductOrder>,
    @InjectRepository(Deposit) private readonly depositsRepo: Repository<Deposit>,
  ) {}

  @Get('pending-orders-count')
  async pendingOrders(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { count: 0 };
    const count = await this.ordersRepo.count({ where: { tenantId, status: 'pending' } as any });
    return { count };
  }

  @Get('pending-deposits-count')
  async pendingDeposits(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { count: 0 };
    const count = await this.depositsRepo.count({ where: { tenantId, status: 'pending' } as any });
    return { count };
  }
}
