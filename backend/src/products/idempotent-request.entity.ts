import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('idempotent_requests')
@Index(['key'], { unique: true })
export class IdempotentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  key: string;

  @Column('uuid', { nullable: true })
  tenantId: string | null;

  @Column('uuid', { nullable: true })
  sourceGlobalProductId: string | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'simple-json' : 'jsonb' })
  resultJson: any;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
