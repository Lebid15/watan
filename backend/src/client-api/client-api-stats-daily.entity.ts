import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('client_api_stats_daily')
@Index('idx_client_api_stats_daily_tenant_date', ['tenantId','date'], { unique: true })
export class ClientApiStatsDaily {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') tenantId: string;
  @Column({ type: 'date' }) date: string; // YYYY-MM-DD
  @Column('int', { default: 0 }) total: number;
  @Column('int', { default: 0 }) ok: number;
  @Column('int', { default: 0 }) err_1xx: number;
  @Column('int', { default: 0 }) err_5xx: number;
  @Column('int', { default: 0 }) code_100: number;
  @Column('int', { default: 0 }) code_105: number;
  @Column('int', { default: 0 }) code_106: number;
  @Column('int', { default: 0 }) code_109: number;
  @Column('int', { default: 0 }) code_110: number;
  @Column('int', { default: 0 }) code_112: number;
  @Column('int', { default: 0 }) code_113: number;
  @Column('int', { default: 0 }) code_114: number;
  @Column('int', { default: 0 }) code_120: number;
  @Column('int', { default: 0 }) code_121: number;
  @Column('int', { default: 0 }) code_122: number;
  @Column('int', { default: 0 }) code_123: number;
  @Column('int', { default: 0 }) code_130: number;
  @Column('int', { default: 0 }) code_429: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
