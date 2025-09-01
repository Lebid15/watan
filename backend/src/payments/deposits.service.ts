// backend/src/payments/deposits.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';

import { Deposit, DepositStatus, DepositSource } from './deposit.entity';
import { PaymentMethod } from './payment-method.entity';
import { User } from '../user/user.entity';
import { Currency } from '../currencies/currency.entity';

import { CreateDepositDto } from './dto/create-deposit.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ListDepositsDto } from './dto/list-deposits.dto';
import { decodeCursor, encodeCursor, toEpochMs } from '../utils/pagination';

@Injectable()
export class DepositsService {
  constructor(
    @InjectRepository(Deposit) private depositsRepo: Repository<Deposit>,
    @InjectRepository(PaymentMethod) private methodsRepo: Repository<PaymentMethod>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Currency) private currenciesRepo: Repository<Currency>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // --------- Helpers (tenancy) ---------

  /** يتأكد أن المستخدم ينتمي لنفس المستأجر */
  private async assertUserInTenant(userId: string, tenantId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId, tenantId } as any });
    if (!user) throw new NotFoundException('المستخدم غير موجود ضمن هذا المستأجر');
    return user;
  }

  /** يجلب وسيلة الدفع ضمن نفس المستأجر */
  private async getMethodInTenant(methodId: string, tenantId: string) {
    const method = await this.methodsRepo.findOne({ where: { id: methodId, tenantId } as any });
    if (!method) throw new BadRequestException('وسيلة الدفع غير متاحة ضمن هذا المستأجر');
    if (!method.isActive) throw new BadRequestException('وسيلة الدفع غير مفعّلة');
    return method;
  }

  /** يجلب إيداعًا ضمن نفس المستأجر */
  private async getDepositInTenant(id: string, tenantId: string, manager = this.depositsRepo.manager) {
    const dep = await manager.findOne(Deposit, { where: { id, tenantId } as any });
    if (!dep) throw new NotFoundException('طلب الإيداع غير موجود ضمن هذا المستأجر');
    return dep;
  }

  // --------- FX rates (مقيدة بالمستأجر) ---------
  private async getRate(code: string, tenantId: string): Promise<number> {
    const c = await this.currenciesRepo.findOne({ where: { code, tenantId } as any });
    if (!c) throw new NotFoundException(`العملة ${code} غير موجودة ضمن هذا المستأجر`);
    const r: any = (c as any).rate ?? (c as any).value ?? null;
    if (r === null || r === undefined) {
      throw new BadRequestException(`لا يوجد سعر صرف للعملة ${code} ضمن هذا المستأجر`);
    }
    return Number(r);
  }

  // --------- User Endpoints ---------

  /** المستخدم: إنشاء طلب إيداع Pending مع فرض tenantId */
  async createDeposit(userId: string, tenantId: string, dto: CreateDepositDto) {
    const user = await this.assertUserInTenant(userId, tenantId);
    let method: PaymentMethod | null = null;
    if (dto.methodId) {
      method = await this.getMethodInTenant(dto.methodId, tenantId);
    }

    if (dto.originalAmount <= 0) throw new BadRequestException('المبلغ يجب أن يكون أكبر من صفر');

    const originalCurrency = dto.originalCurrency.toUpperCase();
    const walletCurrency = dto.walletCurrency.toUpperCase();

  const rFrom = await this.getRate(originalCurrency, tenantId);
  const rTo = await this.getRate(walletCurrency, tenantId);

    const ratio = rTo / rFrom;
    const convertedAmount = Number(dto.originalAmount) * ratio;

    const entity = this.depositsRepo.create({
      tenantId,
      user_id: user.id,
      method_id: method ? method.id : null,
      originalAmount: dto.originalAmount.toString(),
      originalCurrency,
      walletCurrency,
      rateUsed: ratio.toString(),
      convertedAmount: convertedAmount.toFixed(6),
      note: dto.note ?? null,
      status: DepositStatus.PENDING,
    });

    return this.depositsRepo.save(entity);
  }

  /**
   * Admin top-up: creates an already-approved deposit (source=admin_topup) and immediately increments balance.
   * Method is required (will later be enforced at controller); if absent we throw.
   * For simplicity originalCurrency = walletCurrency = user's currency (or dto.walletCurrency fallback) and rateUsed=1.
   */
  async createAdminTopup(
    userId: string,
    tenantId: string,
    amount: number,
    methodId: string,
    note?: string,
  ) {
    if (!methodId) throw new BadRequestException('methodId مطلوب');
    if (!(amount > 0)) throw new BadRequestException('المبلغ يجب أن يكون أكبر من صفر');
    return this.dataSource.transaction(async (manager) => {
      const user = await this.assertUserInTenant(userId, tenantId);
      // load user's currency code if available
      const userWithCurrency = await manager.getRepository(User).findOne({ where: { id: user.id, tenantId } as any, relations: ['currency'] });
      const walletCurrency = (userWithCurrency?.currency?.code || 'TRY').toUpperCase();
      const method = await this.getMethodInTenant(methodId, tenantId);

      const rounded = Number((Math.round(amount * 100) / 100).toFixed(2));

      // Update balance first (optimistic) then create deposit record referencing final amount
      await manager
        .createQueryBuilder()
        .update(User)
        .set({ balance: () => `ROUND(COALESCE(balance,0) + (${rounded}), 2)` })
        .where('id = :uid', { uid: user.id })
        .andWhere('tenantId = :tid', { tid: tenantId })
        .execute();

      const dep = manager.create(Deposit, {
        tenantId,
        user_id: user.id,
        method_id: method.id,
        originalAmount: rounded.toFixed(6),
        originalCurrency: walletCurrency,
        walletCurrency,
        rateUsed: '1',
        convertedAmount: rounded.toFixed(6),
        note: note ?? null,
        status: DepositStatus.APPROVED,
        source: DepositSource.ADMIN_TOPUP,
  approvedAt: new Date(),
      });
      await manager.save(dep);

      // Fire-and-forget notifications (reuse depositApproved so UI stays consistent)
      setImmediate(() => {
        try {
          void this.notifications.depositApproved(
            user.id,
            tenantId,
            rounded,
            method.name,
            { depositId: dep.id, adminTopup: true },
          );
        } catch {/* ignore */}
      });

      return dep;
    });
  }

  /** (توافق خلفي) مصفوفة بسيطة بدون باجينيشن – مع فرض tenantId */
  findMy(userId: string, tenantId: string) {
    return this.depositsRepo.find({
      where: { user_id: userId, tenantId } as any,
      relations: { method: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** المستخدم: باجينيشن cursor { items, pageInfo } — مع فرض tenantId */
  async listMineWithPagination(
    userId: string,
    tenantId: string,
  dto: { limit?: number; cursor?: string | null; source?: 'user_request' | 'admin_topup' | null },
  ) {
    // تأكيد أن المستخدم ضمن المستأجر (حماية إضافية)
    await this.assertUserInTenant(userId, tenantId);

    const limit = Math.max(1, Math.min(100, dto.limit ?? 20));
    const cursor = decodeCursor(dto.cursor);

    const qb = this.depositsRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.method', 'm')
      .where('d.tenantId = :tid', { tid: tenantId })
      .andWhere('d.user_id = :uid', { uid: userId });

    if (dto.source && (dto.source === 'user_request' || dto.source === 'admin_topup')) {
      qb.andWhere('d.source = :src', { src: dto.source });
    }

    // Keyset pagination based on ordering: approvedAt DESC NULLS LAST, createdAt DESC, id DESC.
    // We implement cursor using createdAt/id (legacy) unless approvedAt present; to avoid complicating existing cursor consumers
    // we leave cursor logic unchanged (still based on createdAt/id) but ordering primary key changed.
    if (cursor) {
      qb.andWhere(new Brackets((b) => {
        b.where('d.createdAt < :cts', { cts: new Date(cursor.ts) })
         .orWhere(new Brackets((bb) => {
           bb.where('d.createdAt = :cts', { cts: new Date(cursor.ts) })
             .andWhere('d.id < :cid', { cid: cursor.id });
         }));
      }));
    }
    // Order: approved first by approval time, then recent pending/rejected by creation time
    qb.orderBy('d.approvedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('d.createdAt', 'DESC')
      .addOrderBy('d.id', 'DESC')
      .take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

    const last = pageItems[pageItems.length - 1] || null;
    const nextCursor = last
      ? encodeCursor(toEpochMs((last as any).createdAt), String((last as any).id))
      : null;

  const items = pageItems.map((d) => {
      const dx = d as any;

      const originalAmount = Number(dx.originalAmount ?? dx.amount ?? 0);
      const originalCurrency = String(dx.originalCurrency ?? dx.currency ?? 'USD');

      const rateUsed = Number(dx.rateUsed ?? dx.fxRate ?? dx.rate ?? 1);

      let convertedAmount = Number(dx.convertedAmount ?? dx.amountConverted ?? dx.amount_wallet ?? NaN);
      if (!Number.isFinite(convertedAmount)) {
        convertedAmount = Number((originalAmount || 0) * (rateUsed || 1));
      }

      const walletCurrency = String(dx.walletCurrency ?? dx.wallet_currency ?? 'TRY');

      return {
        id: dx.id,
        method: dx.method
          ? {
              id: dx.method.id,
              name: (dx.method as any).name ?? '',
              type: (dx.method as any).type ?? undefined,
              logoUrl: (dx.method as any).logoUrl ?? (dx.method as any).imageUrl ?? null,
            }
          : null,
        originalAmount,
        originalCurrency,
        walletCurrency,
        rateUsed,
        convertedAmount,
        note: dx.note ?? null,
        status: dx.status,
        source: dx.source ?? 'user_request',
  approvedAt: dx.approvedAt ?? (dx.status === 'approved' ? dx.createdAt : null),
        createdAt: dx.createdAt,
      };
    });

    return {
      items,
      pageInfo: { nextCursor, hasMore },
      meta: { limit },
    };
  }

  // --------- Admin Endpoints (tenancy enforced) ---------

  /** المشرف: جميع الطلبات (بسيط) — مع فرض tenantId */
  findAllAdmin(tenantId: string) {
    return this.depositsRepo.find({
      where: { tenantId } as any,
      relations: { user: true, method: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * المشرف: تغيير الحالة مع عكس أثر الرصيد ضمن نفس المستأجر
   * القواعد:
   * - pending -> approved: شحن الرصيد بقيمة convertedAmount
   * - pending -> rejected: لا شيء
   * - rejected -> approved: شحن الرصيد بقيمة convertedAmount
   * - approved -> rejected: خصم نفس قيمة convertedAmount
   * - أي انتقال إلى pending بعد قرار نهائي: غير مسموح
   * - نفس الحالة: لا شيء
   */
  async setStatus(id: string, tenantId: string, newStatus: DepositStatus) {
    return this.dataSource.transaction(async (manager) => {
      // 1) اجلب الإيداع ضمن نفس المستأجر
      const dep = await this.getDepositInTenant(id, tenantId, manager);
      const oldStatus = dep.status;
      if (newStatus === oldStatus) return dep;

      if (newStatus === DepositStatus.PENDING && oldStatus !== DepositStatus.PENDING) {
        throw new BadRequestException('لا يمكن إعادة الحالة إلى قيد المراجعة بعد اتخاذ القرار.');
      }

      // 2) احسب delta
      const amount = Number((dep as any).convertedAmount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('قيمة التحويل غير صالحة لهذا الإيداع.');
      }

      let delta = 0;
      if (newStatus === DepositStatus.APPROVED && oldStatus !== DepositStatus.APPROVED) {
        // pending/rejected -> approved
        delta = amount;
      } else if (oldStatus === DepositStatus.APPROVED && newStatus !== DepositStatus.APPROVED) {
        // approved -> rejected
        delta = -amount;
      }

      // 3) طبّق التعديل على الرصيد للمستخدم ضمن نفس المستأجر فقط
      if (delta !== 0) {
        const deltaRounded = Number((Math.round(delta * 100) / 100).toFixed(2));
        await manager
          .createQueryBuilder()
          .update(User)
          .set({ balance: () => `ROUND(COALESCE(balance,0) + (${deltaRounded}), 2)` })
          .where('id = :uid', { uid: dep.user_id })
          .andWhere('tenantId = :tid', { tid: tenantId })
          .execute();
      }

      // 4) حدّث حالة الإيداع واحفظ
      dep.status = newStatus;
      if (newStatus === DepositStatus.APPROVED && !dep.approvedAt) {
        dep.approvedAt = new Date();
      }
      await manager.save(dep);

    // 5) إشعارات (Fire-and-forget)
    setImmediate(() => {
      try {
        if (newStatus === DepositStatus.APPROVED) {
          // userId, tenantId, amount, methodName?, meta?
          void this.notifications.depositApproved(
            dep.user_id,
            tenantId,
            amount,
            undefined,
            { depositId: dep.id }
          );
        } else if (newStatus === DepositStatus.REJECTED) {
          const origAmt = Number((dep as any).originalAmount ?? 0);
          const origCur = (dep as any).originalCurrency;
          // userId, tenantId, originalAmount, originalCurrency, methodName?, meta?
          void this.notifications.depositRejected(
            dep.user_id,
            tenantId,
            origAmt,
            origCur,
            undefined,
            { depositId: dep.id }
          );
        }
      } catch {
        /* تجاهل أي فشل بالإشعار */
      }
    });


      return dep;
    });
  }

  /** المشرف: قائمة الإيداعات مع باجينيشن — مع فرض tenantId */
  async listWithPagination(dto: ListDepositsDto, tenantId: string) {
    const limit = Math.max(1, Math.min(100, dto.limit ?? 25));
    const cursor = decodeCursor(dto.cursor);

    const qb = this.depositsRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.user', 'u')
      .leftJoinAndSelect('d.method', 'm')
      .where('d.tenantId = :tid', { tid: tenantId });

    if (dto.status) qb.andWhere('d.status = :status', { status: dto.status });
    if (dto.methodId) qb.andWhere('m.id = :mid', { mid: dto.methodId });
    if (dto.from) qb.andWhere('d.createdAt >= :from', { from: new Date(dto.from + 'T00:00:00Z') });
    if (dto.to) qb.andWhere('d.createdAt <= :to', { to: new Date(dto.to + 'T23:59:59Z') });

    const qRaw = (dto.q || '').trim();
    if (qRaw) {
      const isDigits = /^\d+$/.test(qRaw);
      if (isDigits) {
        qb.andWhere('CAST(d.id AS TEXT) ILIKE :qexact', { qexact: qRaw });
      } else {
        const q = `%${qRaw.toLowerCase()}%`;
        qb.andWhere(new Brackets((b) => {
          b.where('LOWER(COALESCE(d.note, \'\')) LIKE :q', { q })
           .orWhere('LOWER(COALESCE(u.username, \'\')) LIKE :q', { q })
           .orWhere('LOWER(COALESCE(u.email, \'\')) LIKE :q', { q })
           .orWhere('LOWER(COALESCE(m.name, \'\')) LIKE :q', { q });
        }));
      }
    }

    if (cursor) {
      qb.andWhere(new Brackets(b => {
        b.where('d.createdAt < :cts', { cts: new Date(cursor.ts) })
         .orWhere(new Brackets(bb => {
           bb.where('d.createdAt = :cts', { cts: new Date(cursor.ts) })
             .andWhere('d.id < :cid', { cid: cursor.id });
         }));
      }));
    }

    qb.orderBy('d.approvedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('d.createdAt', 'DESC')
      .addOrderBy('d.id', 'DESC')
      .take(limit + 1);

    const rows = await qb.getMany();

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

    const last = pageItems[pageItems.length - 1] || null;
    const nextCursor = last ? encodeCursor(toEpochMs((last as any).createdAt), String((last as any).id)) : null;

    const items = pageItems.map((d) => {
      const dx = d as any;
      const originalAmount = Number(dx.originalAmount ?? dx.amount ?? 0);
      const originalCurrency = String(dx.originalCurrency ?? dx.currency ?? 'USD');
      const rateUsed = Number(dx.rateUsed ?? dx.fxRate ?? dx.rate ?? 1);

      let convertedAmount = Number(dx.convertedAmount ?? dx.amountConverted ?? dx.amount_wallet ?? NaN);
      if (!Number.isFinite(convertedAmount)) {
        convertedAmount = Number((originalAmount || 0) * (rateUsed || 1));
      }

      const walletCurrency = String(dx.walletCurrency ?? dx.wallet_currency ?? 'TRY');

      return {
        id: dx.id,
        user: dx.user
          ? {
              id: dx.user.id,
              email: (dx.user as any).email ?? undefined,
              fullName: (dx.user as any).fullName ?? undefined,
              username: (dx.user as any).username ?? undefined,
            }
          : null,
        method: dx.method
          ? {
              id: dx.method.id,
              name: (dx.method as any).name ?? '',
              type: (dx.method as any).type ?? undefined,
            }
          : null,
        originalAmount,
        originalCurrency,
        rateUsed,
        convertedAmount,
        walletCurrency,
        note: dx.note ?? null,
        status: dx.status,
        source: dx.source ?? 'user_request',
  approvedAt: dx.approvedAt ?? (dx.status === 'approved' ? dx.createdAt : null),
        createdAt: dx.createdAt,
      };
    });

    return {
      items,
      pageInfo: { nextCursor, hasMore },
      meta: {
        limit,
        appliedFilters: {
          q: dto.q || '',
          status: dto.status || '',
          methodId: dto.methodId || '',
          from: dto.from || '',
          to: dto.to || '',
        },
      },
    };
  }
}
