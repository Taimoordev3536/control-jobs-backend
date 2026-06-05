import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AnnouncementSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AnnouncementStatus = 'SENT' | 'SCHEDULED' | 'CANCELLED' | 'FAILED';

@Entity('cjobs_announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'public_id',
    type: 'uuid',
    unique: true,
    default: () => 'uuid_generate_v4()',
  })
  publicId: string;

  @Column({ name: 'sender_user_id' })
  @Index()
  senderUserId: number;

  @Column({ name: 'sender_role', length: 20 })
  senderRole: string;

  @Column({ type: 'jsonb' })
  segments: string[];

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ length: 20, default: 'INFO' })
  severity: AnnouncementSeverity;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ length: 20, default: 'SENT' })
  status: AnnouncementStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'recipient_count', type: 'int', nullable: true })
  recipientCount: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
