import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('product_image_metrics_snapshot')
export class ProductImageMetricsSnapshot {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz' })
  @Index()
  createdAt: Date;

  @Column('int')
  customCount: number;

  @Column('int')
  catalogCount: number;

  @Column('int')
  missingCount: number;
}
