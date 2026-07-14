import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('backups')
export class BackupRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column()
  filename: string;

  @Column({ default: 'LOCAL' })
  provider: string;

  @Column({ type: 'text', nullable: true })
  ref: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes: number;

  @Column({ default: 'SUCCESS' })
  status: string;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'triggered_by', nullable: true })
  triggeredBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
