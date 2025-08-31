import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { ProductPackage } from './product-package.entity';

@Entity('product')
@Index(['tenantId', 'name'], { unique: true }) // اسم المنتج فريد داخل نفس الـ tenant
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // New fallback fields (Phase 1)
  // customImageUrl: صورة مخصصة لهذا المنتج (أولوية أولى إن وُجدت وكان useCatalogImage=false)
  @Column({ type: 'varchar', length: 500, nullable: true })
  customImageUrl?: string | null;

  // customAltText: نص بديل مخصص (أولوية إذا كانت الصورة مخصصة أو حتى مع الكتالوج بهدف تحسين الوصولية)
  @Column({ type: 'varchar', length: 300, nullable: true })
  customAltText?: string | null;

  // Stored derivative thumbnails (generated once on upload / change)
  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbSmallUrl?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbMediumUrl?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbLargeUrl?: string | null;

  @Column({ default: true })
  isActive: boolean;

  // مرجع المنتج العالمي الأصلي عند الاستنساخ (اختياري)
  @Column('uuid', { nullable: true })
  @Index()
  sourceGlobalProductId?: string | null;

  @OneToMany(() => ProductPackage, (pkg) => pkg.product, { cascade: true })
  packages: ProductPackage[];
}

import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { ProductPackage } from './product-package.entity';

@Entity('product')
@Index(['tenantId', 'name'], { unique: true }) // اسم المنتج فريد داخل نفس الـ tenant
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

<<<<<<< HEAD
=======
  // Phase2: الربط بالكتالوج (nullable في البداية ثم سنقيد لاحقًا حسب الحاجة)
  @Column({ type: 'uuid', nullable: true })
  @Index()
  catalogProductId?: string | null;
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;


  // New fallback fields (Phase 1)
  // customImageUrl: صورة مخصصة لهذا المنتج (أولوية أولى إن وُجدت وكان useCatalogImage=false)
  @Column({ type: 'varchar', length: 500, nullable: true })
  customImageUrl?: string | null;


  // customAltText: نص بديل مخصص (أولوية إذا كانت الصورة مخصصة أو حتى مع الكتالوج بهدف تحسين الوصولية)
  @Column({ type: 'varchar', length: 300, nullable: true })
  customAltText?: string | null;

  // Stored derivative thumbnails (generated once on upload / change)
  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbSmallUrl?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbMediumUrl?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbLargeUrl?: string | null;


  @Column({ default: true })
  isActive: boolean;

  // مرجع المنتج العالمي الأصلي عند الاستنساخ (اختياري)
  @Column('uuid', { nullable: true })
  @Index()
  sourceGlobalProductId?: string | null;

  @OneToMany(() => ProductPackage, (pkg) => pkg.product, { cascade: true })
  packages: ProductPackage[];
}
