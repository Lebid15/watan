import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductPackage } from './product-package.entity';

// Minimal mapping entity (e.g. mapping to external provider package id)
@Entity('product_package_mapping')
export class ProductPackageMapping {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenantId?: string | null;
  @ManyToOne(() => ProductPackage, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'package_id' })
  package?: ProductPackage | null;

  @Column({ type: 'varchar', length: 120, nullable: true }) providerName?: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) externalPackageId?: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) externalServiceName?: string | null;
}
