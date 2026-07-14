import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SurveyFormQuestion } from './survey-form-question.entity';
import { SurveyFormResponse } from './survey-form-response.entity';

export type SurveyAudience = 'WORKERS' | 'CLIENTS';
export type SurveyStatus = 'draft' | 'active' | 'closed';

// Standalone employer survey (separate from the per-job Survey feature).
@Entity('cjobs_survey_forms')
export class SurveyForm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'employer_id' })
  @Index()
  employerId: number;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Who receives this survey: all workers or all clients of the employer.
  @Column({ length: 20 })
  audience: SurveyAudience;

  // Anonymous responses do not store the respondent's user id.
  @Column({ default: false })
  anonymous: boolean;

  @Column({ length: 20, default: 'draft' })
  status: SurveyStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  // Auto-delete responses older than this many days (null = keep indefinitely).
  @Column({ name: 'retention_days', type: 'int', nullable: true })
  retentionDays: number | null;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId: number | null;

  @OneToMany(() => SurveyFormQuestion, (q) => q.form)
  questions: SurveyFormQuestion[];

  @OneToMany(() => SurveyFormResponse, (r) => r.form)
  responses: SurveyFormResponse[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
