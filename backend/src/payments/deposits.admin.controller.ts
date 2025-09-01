import { Body, Controller, Get, Param, Patch, UseGuards, Query, Req, Post, BadRequestException } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { UpdateDepositStatusDto } from './dto/update-deposit-status.dto';
import { ListDepositsDto } from './dto/list-deposits.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/deposits')
export class DepositsAdminController {
  constructor(private readonly depositsService: DepositsService) {}

  /** GET /admin/deposits?limit=&cursor=&q=&status=&methodId=&from=&to= */
  @Get()
  list(@Req() req: any, @Query() query: ListDepositsDto) {
    const tenantId = req.user?.tenantId as string;
    return this.depositsService.listWithPagination(query, tenantId);
  }

  @Patch(':id/status')
  setStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDepositStatusDto) {
    const tenantId = req.user?.tenantId as string;
    return this.depositsService.setStatus(id, tenantId, dto.status);
  }

  /** POST /admin/deposits/topup  { userId, amount, methodId, note? } */
  @Post('topup')
  async adminTopup(
    @Req() req: any,
    @Body('userId') userId: string,
    @Body('amount') amount: number,
    @Body('methodId') methodId: string,
    @Body('note') note?: string,
  ) {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) throw new BadRequestException('Tenant context required');
    if (!userId) throw new BadRequestException('userId مطلوب');
    if (!(amount > 0)) throw new BadRequestException('المبلغ يجب أن يكون > 0');
    if (!methodId) throw new BadRequestException('methodId مطلوب');

    const dep = await this.depositsService.createAdminTopup(userId, tenantId, Number(amount), methodId, note);

    return {
      deposit: {
        id: dep.id,
        userId: dep.user_id,
        methodId: dep.method_id,
        originalAmount: Number(dep.originalAmount),
        originalCurrency: dep.originalCurrency,
        walletCurrency: dep.walletCurrency,
        convertedAmount: Number(dep.convertedAmount),
        status: dep.status,
        source: (dep as any).source,
        note: dep.note ?? null,
        createdAt: dep.createdAt,
      },
      // استعلام الرصيد الحالي للمستخدم بعد التعديل (استخدام الخدمة قد يوفر استعلاماً؛ هنا استعلام خفيف)
      balance: await this.depositsService['usersRepo'].findOne({ where: { id: userId, tenantId } as any }).then(u => Number(u?.balance ?? 0)),
    };
  }
}
