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
// استبدال الفهرس المركب (tenantId, publicCode) بفهرس فريد عالمي على publicCode فقط (Migration تضمن الإسقاط والإنشاء)
@Index('ux_product_packages_public_code', ['publicCode'], { unique: true })
@Index('idx_product_packages_tenant_active', ['tenantId', 'isActive'])
@Index('idx_product_packages_product_id', ['product']) // يُنشئ فهرسًا على product_id
export class ProductPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  publicCode: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  name: string | null;

  // Phase2: catalogLinkCode يربط هذه الباقة بباقات الكتالوج (nullable مؤقتًا حتى الترحيل)
  @Column({ type: 'varchar', length: 80, nullable: true })
  @Index('idx_product_packages_catalogLinkCode_field')
  catalogLinkCode?: string | null;

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
