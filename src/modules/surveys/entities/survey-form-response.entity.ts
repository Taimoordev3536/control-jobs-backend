import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SurveyForm } from './survey-form.entity';
import { SurveyFormAnswer } from './survey-form-answer.entity';

@Entity('cjobs_survey_form_responses')
export class SurveyFormResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @ManyToOne(() => SurveyForm, (f) => f.responses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  @Index()
  form: SurveyForm;

  // Null when the survey is anonymous.
  @Column({ name: 'respondent_user_id', nullable: true })
  respondentUserId: number | null;

  @Column({ name: 'respondent_role', length: 20 })
  respondentRole: string; // 'WORKER' | 'CLIENT'

  @OneToMany(() => SurveyFormAnswer, (a) => a.response)
  answers: SurveyFormAnswer[];

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;
}
