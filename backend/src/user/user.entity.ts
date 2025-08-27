// src/user/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PriceGroup } from '../products/price-group.entity';
import { Currency } from '../currencies/currency.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity('users')
@Index('idx_users_tenant', ['tenantId'])
@Index('uniq_users_tenant_email', ['tenantId', 'email'], { unique: true })
@Index('uniq_users_tenant_username', ['tenantId', 'username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔹 بعض المستخدمين (مثل INSTANCE_OWNER) ممكن ما يكون عندهم tenantId
  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  adminId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  admin?: User | null;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ default: 'user' })
  role: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  countryCode: string;

  @Column({ nullable: true })
  nationalId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  overdraftLimit: number;

  // مرحلة 1: عمود تفضيل عملة للموزّع (NULLABLE الآن)
  @Column({ type: 'varchar', length: 10, nullable: true })
  preferredCurrencyCode?: string | null;

  @Column({ type: 'uuid', nullable: true })
  price_group_id?: string | null;

  // Phase3: الربط الهرمي لمستخدمي الموزّع
  @Column({ type: 'uuid', nullable: true })
  parentUserId?: string | null;

  @ManyToOne(() => PriceGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'price_group_id' })
  priceGroup?: PriceGroup | null;

  @Column({ type: 'uuid', nullable: true })
  currency_id?: string | null;

  @ManyToOne(() => Currency, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'currency_id' })
  currency?: Currency | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'boolean', default: false }) emailVerified: boolean;
  // Use generic datetime when running with in-memory sqlite for tests
  @Column({
    // Fallback to 'datetime' for sqlite tests
    type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz',
    nullable: true,
  })
  emailVerifiedAt?: Date | null;

  // Phase4: تمكين واجهة API خارجية (nullable حتى التفعيل اليدوي)
  @Column({ type: 'boolean', nullable: true, default: false })
  apiEnabled?: boolean | null;
}
