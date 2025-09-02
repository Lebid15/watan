import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/user.entity';

@Entity('passkey_credentials')
@Index('idx_passkey_user', ['userId'])
@Index('idx_passkey_tenant_user', ['tenantId', 'userId'])
export class PasskeyCredential {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true }) tenantId: string | null;

  @Column({ type: 'varchar', length: 200, unique: true }) credentialId: string; // base64url

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'blob' : 'bytea' }) publicKey: Buffer;

  @Column({ type: 'bigint', default: 0 }) counter: number;

  @Column({
    // arrays unsupported in sqlite, fall back to simple-json
    type: process.env.TEST_DB_SQLITE === 'true' ? 'simple-json' : 'text',
    array: process.env.TEST_DB_SQLITE === 'true' ? false : true,
    nullable: true,
  })
  transports?: string[] | null;

  @Column({ type: 'varchar', length: 30, nullable: true }) deviceType?: string | null; // singleDevice | multiDevice

  @Column({ type: 'boolean', nullable: true }) backedUp?: boolean | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz',
    name: 'last_used_at',
    nullable: true,
  })
  lastUsedAt?: Date | null;
}