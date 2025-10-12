import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from './job.entity';
import { Shift } from './shift.entity';

@Entity('shift_instance')
export class ShiftInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, { nullable: false })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'job_id' })
  jobId: number;

  @ManyToOne(() => Shift, { nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift?: Shift;

  @Column({ name: 'shift_id', nullable: true })
  shiftId?: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'timestamptz', name: 'end_time' })
  endTime: Date;

  @Column({ type: 'int', nullable: true })
  totalHours?: number;

  @Column({ type: 'boolean', name: 'is_generated', default: true })
  isGenerated: boolean;
}
