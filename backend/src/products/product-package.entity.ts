import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { PackagePrice } from './package-price.entity';

@Entity('product_packages')
// تعديل: جعل uniqueness على (tenantId, publicCode) بدلاً من global publicCode
// التفرد الآن داخل نفس المنتج فقط (product_id, publicCode)
@Index('ux_product_packages_product_public_code', ['product', 'publicCode'], { unique: true })
@Index('idx_product_packages_tenant_active', ['tenantId', 'isActive'])
@Index('idx_product_packages_product_id', ['product']) // يُنشئ فهرسًا على product_id
export class ProductPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

  @Column({ type: 'integer', nullable: true })
  publicCode: number | null; // بعد الترقية: رقم موجب فريد عالميًا (مسموح NULL)

  @Column({ type: 'varchar', length: 160, nullable: true })
  name: string | null;

<<<<<<< HEAD
=======
  // Phase2: catalogLinkCode يربط هذه الباقة بباقات الكتالوج (nullable مؤقتًا حتى الترحيل)
  @Column({ type: 'varchar', length: 80, nullable: true })
  @Index('idx_product_packages_catalogLinkCode_field')
  catalogLinkCode?: string | null;
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

  // عند إنشائها من موزّع نحدد المالك
  @Column({ type: 'uuid', nullable: true })
  @Index('idx_product_packages_createdByDistributorId_field')
  createdByDistributorId?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  capital: number;

  // اسم المزود (barakat, apstore, znet, local, ...)
  @Column({ type: 'varchar', length: 120, nullable: true })
  providerName?: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Product, (product) => product.packages, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'product_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_product_packages_product_id',
  })
  product: Product;

  @OneToMany(() => PackagePrice, (pp) => pp.package, { cascade: true, eager: true })
  prices: PackagePrice[];
}
