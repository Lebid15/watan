import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
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
  @Column({ length: 40, unique: true })
  @Index({ unique: true })
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

  @OneToMany(() => TenantDomain, (d) => d.tenant)
  domains: TenantDomain[];
}
