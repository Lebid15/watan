import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('muh_exports')
export class MuhExport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  total_usd_at_export!: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  usd_to_try_at_export!: string;

  @Column({ type: 'jsonb', nullable: true })
  snapshot?: any; // stores parties + rate at export time

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;
}
