import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('client_api_request_logs')
@Index('idx_client_api_logs_user', ['userId'])
export class ClientApiRequestLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column('uuid') tenantId: string;
  @Column({ type: 'varchar', length: 60 }) method: string;
  @Column({ type: 'varchar', length: 200 }) path: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip?: string | null;
  @Column({ type: 'int' }) code: number; // mapped client api code or 0 for success
  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : undefined }) createdAt: Date;
}
