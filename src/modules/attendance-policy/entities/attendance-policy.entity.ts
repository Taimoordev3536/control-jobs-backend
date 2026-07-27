import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from '../../job/entities/job.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { Employer } from '../../employers/entities/employer.entity';

/**
 * When a session should be chased and closed, and whether work past the shift
 * counts. Every setting is nullable: NULL means "inherit from the level above".
 * All durations are minutes so nothing has to convert between units.
 */
@Entity('attendance_policy')
export class AttendancePolicy {
  @PrimaryGeneratedColumn()
  id: number;

  // Exactly one scope is set. Employer is the company default; job and worker
  // override only the fields they fill in.
  @Column({ name: 'employer_id', nullable: true, unique: true })
  employerId?: number;

  @Column({ name: 'job_id', nullable: true, unique: true })
  jobId?: number;

  @Column({ name: 'worker_id', nullable: true, unique: true })
  workerId?: number;

  @Column({ name: 'extra_hours_allowed', type: 'boolean', nullable: true })
  extraHoursAllowed?: boolean | null;

  // Extra hours OFF: work past the shift is not authorised.
  @Column({ name: 'close_after_shift_end_mins', type: 'int', nullable: true })
  closeAfterShiftEndMins?: number | null;

  /** Record the shift's scheduled end rather than the moment we closed it. */
  @Column({ name: 'record_scheduled_end', type: 'boolean', nullable: true })
  recordScheduledEnd?: boolean | null;

  // Extra hours ON: wait long enough not to cut real overtime short.
  @Column({ name: 'extra_hours_wait_mins', type: 'int', nullable: true })
  extraHoursWaitMins?: number | null;

  @Column({ name: 'notify_worker_after_mins', type: 'int', nullable: true })
  notifyWorkerAfterMins?: number | null;

  @Column({ name: 'notify_employer_after_mins', type: 'int', nullable: true })
  notifyEmployerAfterMins?: number | null;

  // Free jobs have no shift to measure from, so these run from the check-in.
  @Column({ name: 'free_notify_worker_mins', type: 'int', nullable: true })
  freeNotifyWorkerMins?: number | null;

  @Column({ name: 'free_notify_employer_mins', type: 'int', nullable: true })
  freeNotifyEmployerMins?: number | null;

  @Column({ name: 'free_close_after_mins', type: 'int', nullable: true })
  freeCloseAfterMins?: number | null;

  @Column({ name: 'early_checkin_mins', type: 'int', nullable: true })
  earlyCheckinMins?: number | null;

  /** Whether arriving early adds to the worked total. */
  @Column({ name: 'count_early_checkin', type: 'boolean', nullable: true })
  countEarlyCheckin?: boolean | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Employer, { nullable: true })
  @JoinColumn({ name: 'employer_id' })
  employer?: Employer;

  @ManyToOne(() => Job, { nullable: true })
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  @ManyToOne(() => Worker, { nullable: true })
  @JoinColumn({ name: 'worker_id' })
  worker?: Worker;
  @Column({ name: 'overtime_requires_approval', type: 'boolean', nullable: true })
  overtimeRequiresApproval?: boolean | null;

  @Column({ name: 'overtime_annual_cap_hours', type: 'int', nullable: true })
  overtimeAnnualCapHours?: number | null;

  @Column({ name: 'overtime_rate_multiplier', type: 'numeric', precision: 5, scale: 2, nullable: true })
  overtimeRateMultiplier?: string | null;

  @Column({ name: 'overtime_default_compensation', type: 'varchar', length: 20, nullable: true })
  overtimeDefaultCompensation?: string | null;

}
