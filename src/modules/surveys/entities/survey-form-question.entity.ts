import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SurveyForm } from './survey-form.entity';

export type SurveyQuestionType =
  | 'rating'
  | 'yes_no'
  | 'single_choice'
  | 'multi_choice'
  | 'text';

@Entity('cjobs_survey_form_questions')
export class SurveyFormQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @ManyToOne(() => SurveyForm, (f) => f.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  @Index()
  form: SurveyForm;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({ length: 500 })
  text: string;

  @Column({ length: 20 })
  type: SurveyQuestionType;

  @Column({ default: true })
  required: boolean;

  // For choice types: string[] of options. For rating: { max: number }.
  @Column({ type: 'jsonb', nullable: true })
  options: any;
}
