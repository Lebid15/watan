import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('muh_settings')
export class MuhSettings {
  @PrimaryColumn({ type: 'int' })
  id: number = 1;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 30 })
  usd_to_try!: string; // string from db
}
