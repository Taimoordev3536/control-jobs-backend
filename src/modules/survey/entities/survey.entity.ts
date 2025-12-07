import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Job } from '../../job/entities/job.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { Client } from '../../clients/entities/client.entity';
import { Worker } from '../../workers/entities/worker.entity';

@Entity('survey')
export class Survey {
  @PrimaryGeneratedColumn()
  id: number;

  // optional link to a job
  @ManyToOne(() => Job, { nullable: true, onDelete: 'CASCADE' })
  job: Job | null;

  // employer that created the survey
  @ManyToOne(() => Employer, { nullable: false })
  employer: Employer;

  // optional target client
  @ManyToOne(() => Client, { nullable: true })
  client: Client | null;

  // optional target worker
  @ManyToOne(() => Worker, { nullable: true })
  worker: Worker | null;

  // Single rating question text
  @Column({ type: 'varchar', length: 500, nullable: true })
  questionText: string | null;

  // Threshold digit (1..10)
  @Column({ type: 'int', nullable: true })
  rateDigit: number | null;

  // Text shown to request reason when out of range
  @Column({ type: 'text', nullable: true })
  textAlertTracking: string | null;

  // Farewell / greeting text
  @Column({ type: 'text', nullable: true })
  greetingText: string | null;

  // periodicity: daily|weekly|monthly
  @Column({ type: 'varchar', length: 20, nullable: true })
  periodicity: string | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'int', nullable: true })
  interval: number | null;

  // Arrays as JSON text
  @Column({ type: 'text', nullable: true })
  weeklyDays: string | null;

  @Column({ type: 'text', nullable: true })
  monthlyDays: string | null;

  @Column({ type: 'text', nullable: true })
  monthlyWeekdays: string | null;

  @Column({ type: 'int', nullable: true })
  monthlyStartWeekday: number | null;

  @Column({ type: 'int', nullable: true })
  monthlyEndWeekday: number | null;

  // send time
  @Column({ type: 'time', nullable: true })
  sendTime: string | null;

  @CreateDateColumn()
  createdAt: Date;

  // (questions previously stored as JSON here were removed - questions are not stored on the survey row)
}