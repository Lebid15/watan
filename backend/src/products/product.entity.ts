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

  // حقول الصور المخصصة (لم يعد هناك fallback للكتالوج)
  @Column({ type: 'varchar', length: 500, nullable: true })
  customImageUrl?: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  customAltText?: string | null;

  // Thumbnails المخزنة
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
