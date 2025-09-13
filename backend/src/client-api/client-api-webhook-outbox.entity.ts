import { Column, Entity, Index, PrimaryGeneratedColumn, BeforeInsert, BeforeUpdate } from 'typeorm';

export type WebhookOutboxStatus = 'pending' | 'delivering' | 'succeeded' | 'failed' | 'dead';

@Entity('client_api_webhook_outbox')
export class ClientApiWebhookOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_client_webhook_outbox_tenant')
  @Column({ type: 'uuid' })
  tenantId!: string;

  @Index('idx_client_webhook_outbox_user')
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  event_type!: string; // order-status

  @Column({ type: 'varchar', length: 600 })
  delivery_url!: string;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb' })
  payload_json!: any;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb', nullable: true })
  headers_json?: any | null; // reserved for future static headers (not using signature)

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: WebhookOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempt_count!: number;

  @Index('idx_client_webhook_outbox_next')
  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', nullable: true })
  next_attempt_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error?: string | null;

  @Column({ type: 'int', nullable: true })
  response_code?: number | null;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', default: () => (process.env.TEST_DB_SQLITE === 'true' ? 'CURRENT_TIMESTAMP' : 'now()') })
  created_at!: Date;

  @Column({ type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz', default: () => (process.env.TEST_DB_SQLITE === 'true' ? 'CURRENT_TIMESTAMP' : 'now()') })
  updated_at!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  _serializeJsonForSqlite() {
    if (process.env.TEST_DB_SQLITE === 'true') {
      if (this.payload_json && typeof this.payload_json !== 'string') {
        try { (this as any).payload_json = JSON.stringify(this.payload_json); } catch {}
      }
      if (this.headers_json && typeof this.headers_json !== 'string') {
        try { (this as any).headers_json = JSON.stringify(this.headers_json); } catch {}
      }
    }
  }
}
