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

  // catalogImageUrl: صورة مرجعية من الكتالوج (نُحضّر لاستبدال legacy imageUrl مستقبلاً)
  @Column({ type: 'varchar', length: 500, nullable: true })
  catalogImageUrl?: string | null;

  // New fallback fields (Phase 1)
  // customImageUrl: صورة مخصصة لهذا المنتج (أولوية أولى إن وُجدت وكان useCatalogImage=false)
  @Column({ type: 'varchar', length: 500, nullable: true })
  customImageUrl?: string | null;

  // catalogAltText: نص بديل افتراضي لصورة الكتالوج (يمكن أن يأتي من مصدر خارجي)
  @Column({ type: 'varchar', length: 300, nullable: true })
  catalogAltText?: string | null;

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

  // useCatalogImage: هل نستعمل صورة كتالوج مشتركة (true) أو الصورة المخصصة (false)
  @Column({ type: 'boolean', default: true })
  useCatalogImage: boolean;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ProductPackage, (pkg) => pkg.product, { cascade: true })
  packages: ProductPackage[];
}
