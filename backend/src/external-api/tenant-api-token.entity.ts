import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('tenant_api_tokens')
@Index('idx_tenant_api_tokens_tenant', ['tenantId'])
@Index('idx_tenant_api_tokens_user', ['userId'])
@Index('idx_tenant_api_tokens_prefix_field', ['tokenPrefix'])
export class TenantApiToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) name?: string | null;
  @Column({ type: 'varchar', length: 8 }) tokenPrefix: string; // first 6-8 chars
  @Column({ type: 'varchar', length: 128 }) tokenHash: string; // sha256 hex (64) now, expandable later
  @Column({ type: 'text' }) scopes: string; // JSON array string
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', nullable: true }) expiresAt?: Date | null;
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', nullable: true }) lastUsedAt?: Date | null;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : undefined }) createdAt: Date;
}
