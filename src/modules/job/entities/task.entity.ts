// import { Entity, PrimaryGeneratedColumn, Column, ManyToOne,OneToMany } from 'typeorm';
// import { Job } from './job.entity';
// import { ShiftType } from './shift.entity';
// import { TaskHistory } from '../entities/task-history.entity';

// export enum TaskTiming {
//   BEFORE = 'before',
//   DURING = 'during',
//   AFTER = 'after',
// }

// export enum TaskPeriodicity {
//   ONCE = 'once',
//   DAILY = 'daily',
//   WEEKLY = 'weekly',
//   MONTHLY = 'monthly',
//   ANNUALLY = 'annually',
//   PERSONALIZED = 'personalized',
// }

// @Entity('task')
// export class Task {
//   @PrimaryGeneratedColumn()
//   id: number;

//   @ManyToOne(() => Job, job => job.tasks, { nullable: false })
//   job: Job;

//   @Column({ type: 'varchar', length: 255 })
//   name: string;

//   @Column({ type: 'text', nullable: true })
//   note: string;

//   @Column({ type: 'int', nullable: true })
//   expectedDuration: number;

//   @Column({ type: 'enum', enum: ShiftType, nullable: true })
//   shift: ShiftType;

//   @Column({ type: 'enum', enum: TaskTiming })
//   timing: TaskTiming;

//   @Column({ type: 'enum', enum: TaskPeriodicity })
//   periodicity: TaskPeriodicity;

//   @Column({ type: 'varchar', length: 50, nullable: true })
//   periodicityValue: string;

//   @Column({ type: 'boolean', default: false })
//   alertTask: boolean;

//   @Column({ type: 'boolean', default: false })
//   pendingTask: boolean;

//   @Column({ type: 'boolean', default: false })
//   isCompleted: boolean;

//   @Column({ type: 'timestamp', nullable: true })
//   completedAt: Date;

//   @Column({ type: 'int', nullable: true })
//   completedByWorkerId: number;

//     @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.task)
//   taskHistories: TaskHistory[];
// } 



// src/entity/task.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Job } from './job.entity';
import { ShiftType } from './shift.entity';
import { TaskHistory } from '../entities/task-history.entity';


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
  YEARLY = 'yearly',
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

  // ---------- Periodicity Config ----------
  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'int', default: 1 })
  interval: number; // every X days/weeks/months/years

  // Once
  @Column({ type: 'date', nullable: true })
  onceDate: Date;

  // Weekly
  @Column('simple-array', { nullable: true })
  weeklyDays: number[]; // 0=Sunday … 6=Saturday

  // Monthly
  @Column('simple-array', { nullable: true })
  monthlyDays: number[]; // 1–31

  @Column('simple-array', { nullable: true })
  monthlyWeekdays: number[]; // 0=Sunday … 6=Saturday

  // Yearly
  @Column('simple-array', { nullable: true })
  yearlyMonths: number[]; // 1–12

  @Column('simple-array', { nullable: true })
  yearlyDays: number[]; // 1–31

  @Column({ type: 'boolean', default: false })
  alertTask: boolean;

  @Column({ type: 'boolean', default: false })
  pendingTask: boolean;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  completedByWorkerId: number;

  @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.task)
  taskHistories: TaskHistory[];

  // ----------------------------------------
}