import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Worker } from '../../workers/entities/worker.entity';

@Entity('cjobs_absence_requests')
export class AbsenceRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'worker_id' })
  workerId: number;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @Column({ name: 'employer_id' })
  employerId: number;

  // vacation | permit | sick | other
  @Column({ length: 20, default: 'vacation' })
  type: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  // pending | approved | rejected | cancelled
  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes: string | null;

  @Column({ name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId: number | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'requested_by_user_id', nullable: true })
  requestedByUserId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
