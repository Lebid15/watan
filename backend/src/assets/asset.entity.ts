import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('assets')
@Index('idx_assets_tenant', ['tenantId'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null; // null لو أصل عام

  @Column({ type: 'uuid', nullable: true })
  uploaderUserId: string | null;

  @Column({ length: 32 })
  role: string; // دور الرافع (admin/developer/...)

  @Column({ length: 48 })
  purpose: string; // products | logo | misc | dev | ...

  @Column({ nullable: true })
  productId?: string | null; // عند الربط لاحقاً

  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 255 })
  publicId: string; // Cloudinary public_id

  @Column({ length: 255 })
  format: string; // تنسيق (jpg/png/...)

  @Column({ type: 'int' })
  bytes: number;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ length: 400 })
  secureUrl: string;

  @Column({ length: 400 })
  folder: string; // watan/tenants/{tenantId}/{purpose}

  @CreateDateColumn() createdAt: Date;
}
