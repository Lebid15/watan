import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TenantSubscriptionStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Entity({ name: 'tenant_subscriptions' })
export class TenantSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column('uuid', { unique: true }) tenantId: string;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'varchar' : 'enum', enum: process.env.TEST_DB_SQLITE === 'true' ? undefined : TenantSubscriptionStatus, default: TenantSubscriptionStatus.ACTIVE, length: process.env.TEST_DB_SQLITE === 'true' ? 20 : undefined })
  status: TenantSubscriptionStatus;

  @Column({ type: 'date', nullable: true }) currentPeriodStart: string | null;
  @Column({ type: 'date', nullable: true }) currentPeriodEnd: string | null;
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', nullable: true }) nextDueAt: Date | null;
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', nullable: true }) lastPaidAt: Date | null;
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', nullable: true }) suspendAt: Date | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) suspendReason: string | null;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' }) createdAt: Date;
  @UpdateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' }) updatedAt: Date;
}
