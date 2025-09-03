import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/user.entity';

@Entity('totp_credentials')
@Index('idx_totp_user', ['userId'])
@Index('idx_totp_tenant_user', ['tenantId', 'userId'])
export class TotpCredential {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true }) tenantId: string | null;

  @Column({ type: 'varchar', length: 200 }) encryptedSecret: string;

  @Column({ type: 'varchar', length: 100, nullable: true }) label: string | null;

  @Column({ type: 'boolean', default: true }) isActive: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz',
    name: 'last_used_at',
    nullable: true,
  })
  lastUsedAt?: Date | null;

  @Column({ type: 'integer', default: 0 }) usageCount: number;
}
