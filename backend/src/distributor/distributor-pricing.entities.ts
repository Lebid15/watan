import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('distributor_price_groups')
@Index(['tenantId','distributorUserId','name'], { unique: true })
export class DistributorPriceGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenantId?: string | null;
  @Column({ type: 'uuid', nullable: true }) distributorUserId?: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) name?: string | null;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('distributor_package_prices')
@Index(['distributorUserId','distributorPriceGroupId','packageId'], { unique: true })
export class DistributorPackagePrice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenantId?: string | null;
  @Column({ type: 'uuid', nullable: true }) distributorUserId?: string | null;
  @Column({ type: 'uuid', nullable: true }) packageId?: string | null;
  @Column({ type: 'uuid', nullable: true }) distributorPriceGroupId?: string | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 }) priceUSD: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('distributor_user_price_groups')
@Index(['distributorPriceGroupId','userId'], { unique: true })
export class DistributorUserPriceGroup {
  @Column({ type: 'uuid', nullable: true, primary: true }) distributorPriceGroupId?: string | null;
  @Column({ type: 'uuid', nullable: true, primary: true }) userId?: string | null;
  @CreateDateColumn() createdAt: Date;
}
