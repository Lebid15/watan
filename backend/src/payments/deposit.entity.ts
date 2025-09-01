import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../user/user.entity';
import { PaymentMethod } from './payment-method.entity';

export enum DepositStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// مصدر الطلب: طلب من المستخدم أو تعبئة رصيد مباشرة من الأدمن
export enum DepositSource {
  USER_REQUEST = 'user_request',
  ADMIN_TOPUP = 'admin_topup',
}

@Entity({ name: 'deposit' })
@Index(['tenantId', 'status', 'createdAt'])
@Index(['tenantId', 'user_id'])
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

  /** المستخدم صاحب الطلب */
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  /** وسيلة الدفع المختارة */
  @ManyToOne(() => PaymentMethod, { onDelete: 'RESTRICT', eager: false, nullable: true })
  @JoinColumn({ name: 'method_id' })
  method?: PaymentMethod | null;

  @Column({ type: 'uuid', nullable: true })
  method_id?: string | null;

  /** مبلغ الإيداع الأصلي والعملة التي أرسل بها */
  @Column({ type: 'numeric', precision: 18, scale: 6 })
  originalAmount: string;

  /** مثال: USD, TRY, EUR ... */
  @Column({ type: 'varchar', length: 10 })
  originalCurrency: string;

  /** عملة محفظة المستخدم (مثلاً TRY) */
  @Column({ type: 'varchar', length: 10 })
  walletCurrency: string;

  /** سعر الصرف المستخدم للتحويل */
  @Column({ type: 'numeric', precision: 18, scale: 6 })
  rateUsed: string;

  /** الناتج بعد التحويل إلى عملة المحفظة */
  @Column({ type: 'numeric', precision: 18, scale: 6 })
  convertedAmount: string;

  /** ملاحظة من المستخدم (اختياري) */
  @Column({ type: 'text', nullable: true })
  note?: string | null;

  /** حالة الطلب */
  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'varchar' : 'enum',
    enum: process.env.TEST_DB_SQLITE === 'true' ? undefined : DepositStatus,
    default: DepositStatus.PENDING,
    length: process.env.TEST_DB_SQLITE === 'true' ? 20 : undefined,
  })
  status: DepositStatus;

  /** مصدر الطلب (لا يسمح للمستخدم بتغييره يحدد داخليًا) */
  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'varchar' : 'enum',
    enum: process.env.TEST_DB_SQLITE === 'true' ? undefined : DepositSource,
    default: DepositSource.USER_REQUEST,
    length: process.env.TEST_DB_SQLITE === 'true' ? 30 : undefined,
  })
  source: DepositSource;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' })
  createdAt: Date;

  /** تاريخ الموافقة (يحدد عند الانتقال لأول مرة إلى approved) */
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', nullable: true })
  approvedAt?: Date | null;
}
