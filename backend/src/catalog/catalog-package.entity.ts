import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogProduct } from './catalog-product.entity';

@Entity('catalog_package')
@Index(['tenantId', 'sourceProviderId', 'externalPackageId'])
@Index(['tenantId', 'publicCode'], { unique: true })
// Phase2: ضمان فريدة linkCode داخل المنتج المنصّي لاحقًا
@Index(['catalogProductId', 'linkCode'], { unique: true })
export class CatalogPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔹 tenantId إجباري
  @Column({ type: 'uuid', nullable: false })
  @Index()
  tenantId: string;

  @ManyToOne(() => CatalogProduct, (p) => p.packages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalogProductId' })
  catalogProduct: CatalogProduct;

  @Column({ type: 'uuid' })
  @Index()
  catalogProductId: string;

  @Column({ length: 200 })
  name: string;

  // اسم افتراضي قابل للتخصيص مستقبلاً
  // Explicit type for sqlite test compatibility (union type caused reflect metadata = Object)
  @Column({ type: 'varchar', length: 200, nullable: true })
  nameDefault?: string | null;

  // linkCode: الكود القياسي للربط عبر المستويات (Phase2)
  @Column({ type: 'varchar', length: 80, nullable: true })
  linkCode?: string | null;

  // كود عام للربط — صار فريدًا لكل tenant
  @Column({ type: 'varchar', length: 120 })
  publicCode: string;

  // لو خارجي
  @Column({ type: 'uuid', nullable: true })
  sourceProviderId?: string | null;

  // معرف الحزمة عند المزود
  @Column({ type: 'varchar', length: 120, nullable: true })
  externalPackageId?: string | null;

  // تكلفة المزود (اختياري كبداية)
  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  costPrice?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currencyCode?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
