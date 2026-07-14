import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'requester_user_id' })
  requesterUserId: number;

  @Column({ name: 'requester_name', nullable: true })
  requesterName: string;

  @Column({ name: 'requester_role', nullable: true })
  requesterRole: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'OPEN' })
  status: string;

  @Column({ type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'responded_by_name', nullable: true })
  respondedByName: string | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
