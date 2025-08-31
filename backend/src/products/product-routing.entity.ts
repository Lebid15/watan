import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductPackage } from './product-package.entity';

// Minimal routing entity restored after merge cleanup
@Entity('product_routing')
export class ProductRouting {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenantId?: string | null;

  @ManyToOne(() => ProductPackage, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'package_id' })
  package?: ProductPackage | null;

  @Column({ type: 'varchar', length: 50, default: 'manual' }) mode: 'manual' | 'auto';
  @Column({ type: 'varchar', length: 100, nullable: true }) providerType?: string | null; // e.g. internal_codes, external_api
  @Column({ type: 'uuid', nullable: true }) codeGroupId?: string | null;
  @Column({ type: 'uuid', nullable: true }) fallbackProviderId?: string | null;
}
