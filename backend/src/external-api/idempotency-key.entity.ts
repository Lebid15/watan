import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('idempotency_keys')
@Index('idx_idempotency_token', ['tokenId'])
@Index('uq_idempotency_token_key_field', ['tokenId', 'key'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tokenId: string;
  @Column({ type: 'varchar', length: 80 }) key: string;
  @Column({ type: 'varchar', length: 128 }) requestHash: string;
  @Column({ type: 'uuid', nullable: true }) orderId?: string | null;
  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : undefined }) createdAt: Date;
  @Column({ type: 'int', default: 86400 }) ttlSeconds: number;
}
