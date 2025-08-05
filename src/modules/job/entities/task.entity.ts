import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Job } from './job.entity';
import { ShiftType } from './shift.entity';

export enum TaskTiming {
  BEFORE = 'before',
  DURING = 'during',
  AFTER = 'after',
}

export enum TaskPeriodicity {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ANNUALLY = 'annually',
  PERSONALIZED = 'personalized',
}

@Entity('task')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, job => job.tasks, { nullable: false })
  job: Job;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'int', nullable: true })
  expectedDuration: number;

  @Column({ type: 'enum', enum: ShiftType, nullable: true })
  shift: ShiftType;

  @Column({ type: 'enum', enum: TaskTiming })
  timing: TaskTiming;

  @Column({ type: 'enum', enum: TaskPeriodicity })
  periodicity: TaskPeriodicity;

  @Column({ type: 'varchar', length: 50, nullable: true })
  periodicityValue: string;

  @Column({ type: 'boolean', default: false })
  alertTask: boolean;

  @Column({ type: 'boolean', default: false })
  pendingTask: boolean;
} 