import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum BillingAnchor {
  EOM = 'EOM',
  DOM = 'DOM',
}

@Entity({ name: 'tenant_billing_config' })
@Index(['tenantId'])
export class TenantBillingConfig {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column('uuid', { unique: true }) tenantId: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true }) monthlyPriceUsd: string | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'varchar' : 'enum', enum: process.env.TEST_DB_SQLITE === 'true' ? undefined : BillingAnchor, default: BillingAnchor.EOM, length: process.env.TEST_DB_SQLITE === 'true' ? 10 : undefined })
  billingAnchor: BillingAnchor;

  @Column({ type: 'int', default: 3 }) graceDays: number;

  @Column({ type: 'boolean', default: false }) isEnforcementEnabled: boolean;

  @Column({ type: 'boolean', default: true }) fxUsdToTenantAtInvoice: boolean;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' }) createdAt: Date;
  @UpdateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' }) updatedAt: Date;
}
