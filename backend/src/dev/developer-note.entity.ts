import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('developer_notes')
export class DeveloperNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', default: '' })
  value: string;

  @Column({ type: 'boolean', default: true, unique: true })
  @Index({ unique: true })
  singleton: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
