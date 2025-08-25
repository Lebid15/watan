import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type ErrorSource = 'backend' | 'frontend';
export type ErrorLevel = 'error' | 'warn' | 'info';
export type ErrorStatus = 'open' | 'resolved';

@Entity('error_logs')
@Index('idx_error_logs_createdAt', ['createdAt'])
@Index('idx_error_logs_source_level', ['source', 'level'])
@Index('idx_error_logs_status', ['status'])
@Index('idx_error_logs_hash', ['hash'])
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  source: ErrorSource;

  @Column({ type: 'varchar', length: 8 })
  level: ErrorLevel;

  @Column({ type: 'varchar', length: 10, default: 'open' })
  status: ErrorStatus;

  @Column({ type: 'varchar', length: 400 })
  message: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name?: string | null;

  @Column({ type: 'text', nullable: true })
  stack?: string | null; // truncated to max length in service

  @Column({ type: 'varchar', length: 300, nullable: true })
  path?: string | null; // request path or frontend location.href (truncated)

  @Column({ type: 'varchar', length: 8, nullable: true })
  method?: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  tenantId?: string | null;

  @Column({ type: 'varchar', length: 400, nullable: true })
  userAgent?: string | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'simple-json' : 'jsonb', nullable: true })
  context?: any | null; // sanitized extra data

  @Column({ type: 'varchar', length: 64 })
  hash: string; // dedup key

  @Column({ type: 'int', default: 1 })
  occurrenceCount: number;

  @CreateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : undefined })
  createdAt: Date;

  @UpdateDateColumn({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : undefined })
  updatedAt: Date;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', nullable: true })
  firstOccurredAt?: Date | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', nullable: true })
  lastOccurredAt?: Date | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', nullable: true })
  resolvedAt?: Date | null;
}
