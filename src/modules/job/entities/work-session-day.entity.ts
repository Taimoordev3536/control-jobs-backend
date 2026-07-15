import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { WorkSession } from './work-session.entity';

@Entity('work_session_day')
@Index('idx_work_session_day_worker_date', ['workerId', 'date'])
@Index('idx_work_session_day_job_date', ['jobId', 'date'])
export class WorkSessionDay {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @ManyToOne(() => WorkSession, { nullable: false })
  @JoinColumn({ name: 'work_session_id' })
  workSession: WorkSession;

  @Column({ name: 'work_session_id' })
  workSessionId: number;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'worker_id' })
  workerId: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'timestamptz', name: 'end_time' })
  endTime: Date;

  @Column({ type: 'int' })
  minutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
