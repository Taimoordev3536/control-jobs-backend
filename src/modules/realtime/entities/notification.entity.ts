import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  role: string; // 'EMPLOYER', 'CLIENT', 'WORKER'

  @Column({ name: 'recipient_id' })
  @Index()
  recipientId: number; // User ID of the recipient

  @Column({ type: 'varchar', length: 50 })
  type: string; // 'CHECK_IN', 'CHECK_OUT'

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  meta: any; // Store jobId, workerId, etc.

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'banner_dismissed', default: false })
  bannerDismissed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;
}
