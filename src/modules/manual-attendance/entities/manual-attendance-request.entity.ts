import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Job } from '../../job/entities/job.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { WorkSession } from '../../job/entities/work-session.entity';
import { User } from '../../users/entities/user.entity';
import { ManualAttendanceRequestType } from '../enums/request-type.enum';
import { ManualAttendanceRequestStatus } from '../enums/request-status.enum';

@Entity('manual_attendance_requests')
export class ManualAttendanceRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  // Who is this for
  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'worker_id' })
  workerId: number;

  @Column({ name: 'work_center_id', nullable: true })
  workCenterId?: number;

  // What type of request
  @Column({ name: 'request_type', type: 'varchar', length: 20 })
  requestType: ManualAttendanceRequestType;

  // Status
  @Column({ type: 'varchar', length: 20, default: ManualAttendanceRequestStatus.PENDING })
  @Index()
  status: ManualAttendanceRequestStatus;

  // Requested attendance data
  @Column({ name: 'requested_date', type: 'date' })
  @Index()
  requestedDate: Date;

  @Column({ name: 'requested_check_in', type: 'timestamptz', nullable: true })
  requestedCheckIn?: Date;

  @Column({ name: 'requested_check_out', type: 'timestamptz', nullable: true })
  requestedCheckOut?: Date;

  // If editing existing session
  @Column({ name: 'existing_work_session_id', nullable: true })
  existingWorkSessionId?: number;

  @Column({ name: 'original_check_in', type: 'timestamptz', nullable: true })
  originalCheckIn?: Date;

  @Column({ name: 'original_check_out', type: 'timestamptz', nullable: true })
  originalCheckOut?: Date;

  // Justification
  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'worker_notes', type: 'text', nullable: true })
  workerNotes?: string;

  // Who created the request
  @Column({ name: 'requested_by_user_id' })
  requestedByUserId: number;

  @Column({ name: 'requested_by_role', type: 'varchar', length: 20 })
  requestedByRole: string; // 'WORKER', 'EMPLOYER', 'CLIENT'

  // Review info
  @Column({ name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId?: number;

  @Column({ name: 'reviewed_by_role', type: 'varchar', length: 20, nullable: true })
  reviewedByRole?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes?: string;

  // Result - the work session created upon approval
  @Column({ name: 'result_work_session_id', nullable: true })
  resultWorkSessionId?: number;

  // Timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Worker)
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @ManyToOne(() => WorkCenter, { nullable: true })
  @JoinColumn({ name: 'work_center_id' })
  workCenter?: WorkCenter;

  @ManyToOne(() => WorkSession, { nullable: true })
  @JoinColumn({ name: 'existing_work_session_id' })
  existingWorkSession?: WorkSession;

  @ManyToOne(() => WorkSession, { nullable: true })
  @JoinColumn({ name: 'result_work_session_id' })
  resultWorkSession?: WorkSession;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedByUser?: User;
}
