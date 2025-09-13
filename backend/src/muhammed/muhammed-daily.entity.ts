import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('muhammed_daily')
@Unique('UQ_muhammed_daily_entry_date', ['entryDate'])
export class MuhammedDaily {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate!: string; // YYYY-MM-DD

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  value?: string | null; // keep as string to avoid float issues

  // Use generic 'datetime' for sqlite in tests to avoid unsupported 'timestamptz'
  @CreateDateColumn({ name: 'created_at', type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz' })
  updatedAt!: Date;
}
