import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/user.entity';

@Entity('recovery_codes')
@Index('idx_recovery_user', ['userId'])
export class RecoveryCode {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 200 }) codeHash: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @Column({
    type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz',
    name: 'used_at',
    nullable: true,
  })
  usedAt?: Date | null;
}
