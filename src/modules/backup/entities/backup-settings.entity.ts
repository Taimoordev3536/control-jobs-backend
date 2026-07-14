import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('backup_settings')
export class BackupSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  enabled: boolean;

  @Column({ name: 'interval_hours', default: 24 })
  intervalHours: number;

  @Column({ default: 'LOCAL' })
  provider: string;

  @Column({ name: 'keep_last', default: 7 })
  keepLast: number;

  @Column({ name: 'local_path', type: 'text', nullable: true })
  localPath: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
