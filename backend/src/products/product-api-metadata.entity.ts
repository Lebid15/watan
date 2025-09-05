import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Product } from './product.entity';

export type ProductQtyMode = 'null' | 'fixed' | 'range' | 'list';

// Holds per-product external Client API metadata (quantity & params schema)
@Entity('product_api_metadata')
export class ProductApiMetadata {
  @PrimaryColumn('uuid', { name: 'product_id' })
  productId: string;

  @OneToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id', referencedColumnName: 'id' })
  product: Product;

  @Column({ name: 'qty_mode', type: 'varchar', length: 10, default: 'null' })
  qtyMode: ProductQtyMode;

  @Column({ name: 'qty_fixed', type: 'integer', default: 1 })
  qtyFixed: number;

  @Column({ name: 'qty_min', type: 'integer', nullable: true })
  qtyMin?: number | null;

  @Column({ name: 'qty_max', type: 'integer', nullable: true })
  qtyMax?: number | null;

  @Column({ name: 'qty_list', type: 'text', array: true, nullable: true })
  qtyList?: string[] | null;

  @Column({ name: 'params_schema', type: 'jsonb', default: () => "'[]'::jsonb" })
  paramsSchema: any[];

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
