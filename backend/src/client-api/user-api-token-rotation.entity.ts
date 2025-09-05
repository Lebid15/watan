import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_api_token_rotations')
@Index('idx_user_api_token_rot_user', ['userId'])
export class UserApiTokenRotation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) oldToken?: string | null;
  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : undefined }) rotatedAt: Date;
}
