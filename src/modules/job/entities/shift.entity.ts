import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Job } from './job.entity';

export enum ShiftType {
  MORNING = 'morning',
  NOON = 'noon',
  EVENING = 'evening',
}

export enum ScheduleType {
  FIXED = 'fixed',
  FLEXIBLE = 'flexible',
}

export enum Season {
  SUMMER = 'summer',
  WINTER = 'winter',
}

@Entity('shift')
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, job => job.shifts, { nullable: false })
  job: Job;

  @Column({ type: 'varchar', length: 20 })
  day: string;

  @Column({ type: 'enum', enum: ShiftType })
  shiftType: ShiftType;

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ type: 'int' })
  totalHours: number;

  @Column({ type: 'enum', enum: ScheduleType })
  scheduleType: ScheduleType;

  @Column({ type: 'enum', enum: Season })
  season: Season;
} 