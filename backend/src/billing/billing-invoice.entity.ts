import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum BillingInvoiceStatus {
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
}

@Entity({ name: 'billing_invoices' })
@Index(['tenantId', 'status'])
@Index(['dueAt'])
export class BillingInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') tenantId: string;

  @Column({ type: 'date' }) periodStart: string;
  @Column({ type: 'date' }) periodEnd: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 }) amountUsd: string;
  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true }) fxUsdToTenantAtInvoice: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) displayCurrencyCode: string | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'varchar' : 'enum', enum: process.env.TEST_DB_SQLITE === 'true' ? undefined : BillingInvoiceStatus, default: BillingInvoiceStatus.OPEN, length: process.env.TEST_DB_SQLITE === 'true' ? 10 : undefined })
  status: BillingInvoiceStatus;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', default: () => process.env.TEST_DB_SQLITE === 'true' ? "(datetime('now'))" : 'now()' }) issuedAt: Date;
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', nullable: true }) dueAt: Date | null;
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone', nullable: true }) paidAt: Date | null;

  @Column({ type: 'uuid', nullable: true }) depositId: string | null; // optional FK to deposit
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' }) createdAt: Date;
  @UpdateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamp with time zone' }) updatedAt: Date;
}
