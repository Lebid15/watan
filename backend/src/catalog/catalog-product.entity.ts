import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogPackage } from './catalog-package.entity';

export type CatalogSourceType = 'external' | 'internal';

@Entity('catalog_product')
// Phase2: سنحوّل هذا لاحقًا لمنتج منصة بدون tenantId (حاليًا موجود).
@Index(['tenantId', 'name'])
export class CatalogProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔹 tenantId إجباري
  @Column({ type: 'uuid', nullable: false })
  @Index()
  tenantId: string;

  @Column({ length: 200 })
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'external' })
  sourceType: CatalogSourceType;

  // لو خارجي: المصدر
  @Column({ type: 'uuid', nullable: true })
  @Index()
  sourceProviderId?: string | null;

  // معرف المنتج لدى المزود الخارجي
  @Column({ type: 'varchar', length: 120, nullable: true })
  @Index()
  externalProductId?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Phase2: بعد عملية publish نحدد المنتجات القابلة للاختيار
  @Column({ type: 'boolean', default: false })
  isPublishable: boolean;

  @OneToMany(() => CatalogPackage, (p) => p.catalogProduct, { cascade: false })
  packages: CatalogPackage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
