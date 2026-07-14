import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Survey } from './survey.entity';
import { Job } from '../../job/entities/job.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { Client } from '../../clients/entities/client.entity';
import { SurveyAnswer } from './survey-answer.entity';

@Entity('survey_response')
export class SurveyResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @ManyToOne(() => Survey, { nullable: false })
  survey: Survey;

  @ManyToOne(() => Job, { nullable: false })
  job: Job;

  @ManyToOne(() => Worker, { nullable: true })
  worker: Worker;

  @ManyToOne(() => Client, { nullable: true })
  client: Client;

  // Period bucket this response covers: 'YYYY-MM-DD' (daily), 'YYYY-Www' (weekly), 'YYYY-MM' (monthly).
  @Column({ name: 'period_key', type: 'varchar', length: 20, nullable: true })
  periodKey: string | null;

  // Single-question survey: the 0–10 rating and an optional reason (required when rating ≤ threshold).
  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  submittedAt: Date;

  @OneToMany(() => SurveyAnswer, answer => answer.response)
  answers: SurveyAnswer[];
} 