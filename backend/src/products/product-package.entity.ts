
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

  // catalogLinkCode removed

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

  // نوع الباقة: ثابتة أم بعدد وحدات (عداد)
  @Column({ type: 'varchar', length: 10, default: 'fixed' })
  type: 'fixed' | 'unit';

  // اسم الوحدة (Gem, Coin, Point ...)
  @Column({ type: 'varchar', length: 40, nullable: true })
  unitName?: string | null;

  // كود اختياري للوحدة (قد يستخدم للتكاملات)
  @Column({ type: 'varchar', length: 40, nullable: true })
  unitCode?: string | null;

  // أقل وأعلى كمية وعدد الخطوة (التحقق التفصيلي في الخدمة وليس Constraint DB)
  @Column({ type: 'int', nullable: true })
  minUnits?: number | null;
  @Column({ type: 'int', nullable: true })
  maxUnits?: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  step?: number | null;

  // السعر الأساسي للوحدة (يُستخدم إن لم توجد price group override)
  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  baseUnitPrice?: number | null;

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
