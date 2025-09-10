import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TenantDomain } from './tenant-domain.entity';

// NOTE: Physical table in production is currently named "tenant" (singular) due to early bootstrap
// migrations. To avoid complex renames and breaking existing rescue migrations that reference
// the singular form, we map the entity explicitly to that table. If later we decide to rename the
// table to "tenants" we must also adjust every raw SQL reference in migrations (many exist).
@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // اسم العرض للوحة المطوّر
  @Column({ length: 120 })
  @Index()
  name: string;

  // كود قصير فريد، يُستخدم لبناء subdomain مثل: code.example.com
  // NOTE: Drop entity-level unique; rely on DB partial unique index (code WHERE deletedAt IS NULL)
  @Column({ length: 40 })
  @Index()
  code: string;

  // مالك المتجر (اختياري الآن)
  @Column({ type: 'uuid', nullable: true })
  ownerUserId?: string | null;

  @Column({ default: true })
  isActive: boolean;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft delete marker
  // Do not force DB type here; let TypeORM choose per driver (sqlite vs postgres)
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at?: Date | null;

  @OneToMany(() => TenantDomain, (d) => d.tenant)
  domains: TenantDomain[];
}
