import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from './job.entity';
import { Worker } from '../../workers/entities/worker.entity';

@Entity('work_sessions')
export class WorkSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'worker_id' })
  workerId: number;

  @Column({ type: 'timestamp', name: 'check_in_time' })
  checkInTime: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'check_out_time' })
  checkOutTime: Date;

  @Column({ type: 'int', default: 0, name: 'total_work_minutes' })
  totalWorkMinutes: number; // Total working time excluding breaks

  @Column({ type: 'int', default: 0, name: 'total_break_minutes' })
  totalBreakMinutes: number; // Total break time

  @Column({ type: 'boolean', default: false, name: 'is_active' })
  isActive: boolean; // Current session status

  @Column({ type: 'boolean', default: false, name: 'is_on_break' })
  isOnBreak: boolean; // Current break status

  @Column({ type: 'timestamp', nullable: true, name: 'current_break_start' })
  currentBreakStart: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job, job => job.workSessions)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Worker, worker => worker.workSessions)
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;
}
