import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PaymentMethodType {
  CASH_BOX = 'CASH_BOX',             // صندوق اعتماد
  BANK_ACCOUNT = 'BANK_ACCOUNT',     // حساب بنكي
  HAND_DELIVERY = 'HAND_DELIVERY',   // تسليم باليد
  USDT = 'USDT',                     // عملة USDT
  MONEY_TRANSFER = 'MONEY_TRANSFER', // حوالات مالية
}

@Entity({ name: 'payment_method' })
@Index(['tenantId', 'name'], { unique: true }) // اسم وسيلة الدفع فريد داخل المستأجر
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

  /** اسم وسيلة الدفع الذي سيظهر للمستخدم */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** النوع (يحدد الحقول داخل config) */
  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'varchar' : 'enum',
    enum: process.env.TEST_DB_SQLITE === 'true' ? undefined : PaymentMethodType,
    length: process.env.TEST_DB_SQLITE === 'true' ? 30 : undefined,
  })
  type: PaymentMethodType;

  /** رابط صورة/لوغو */
  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  /** ملاحظة عامة */
  @Column({ type: 'text', nullable: true })
  note?: string | null;

  /** تفعيل/تعطيل الوسيلة */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * الحقول الديناميكية الخاصة بكل نوع
   */
  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'simple-json' : 'jsonb',
    default: process.env.TEST_DB_SQLITE === 'true' ? undefined : {},
    nullable: process.env.TEST_DB_SQLITE === 'true',
  })
  config: Record<string, any>;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' })
  updatedAt: Date;
}
