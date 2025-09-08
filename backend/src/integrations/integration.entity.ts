import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ProviderKind = 'barakat' | 'apstore' | 'znet' | 'internal';
export type IntegrationScope = 'dev' | 'tenant';

@Entity('integrations')
@Index(['tenantId', 'name'], { unique: true }) // الاسم فريد داخل كل مستأجر
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 120 })
  name!: string;

  @Index('idx_integrations_provider')
  @Column({ type: 'varchar', length: 20 })
  provider!: ProviderKind;

  // dev = مزود المطوّر (مصدر الكتالوج)
  // tenant = مزود المشرف (لتنفيذ الطلبات)
  @Index('idx_integrations_scope')
  @Column({ type: 'varchar', length: 10, default: 'tenant' })
  scope!: IntegrationScope;

  @Column({ type: 'varchar', length: 255, nullable: true })
  baseUrl?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiToken?: string | null;

  // لزنت
  @Column({ type: 'varchar', length: 120, nullable: true })
  kod?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sifre?: string | null;

  // تفعيل/تعطيل سريع للتكامل (يوقف جميع الاستدعاءات عند false)
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  // آخر رصيد تم جلبه (يحدث عند refreshBalance)
  @Column({ type: 'numeric', precision: 18, scale: 3, nullable: true })
  balance?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  balanceUpdatedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
