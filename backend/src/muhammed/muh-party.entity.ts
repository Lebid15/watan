import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('muh_parties')
export class MuhParty {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  debt_try!: string; // keep raw string from pg

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  debt_usd!: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'int', nullable: true })
  display_order?: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at!: Date;
}
