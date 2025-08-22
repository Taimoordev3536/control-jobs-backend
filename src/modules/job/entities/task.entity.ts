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

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  completedByWorkerId: number;

  @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.task)
  taskHistories: TaskHistory[];

  // New fields for advanced periodicity
  @Column({ type: 'date', nullable: true })
  periodicityDate: string; // e.g., '2025-08-21' for 'once' or 'personalized'

  @Column('simple-array', { nullable: true })
  weeklyDays: string[]; // e.g., ['L', 'M', 'X'] for 'weekly'

  @Column({ type: 'int', nullable: true })
  monthlyDay: number; // e.g., 15 for 'monthly'
}