import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SurveyFormResponse } from './survey-form-response.entity';

@Entity('cjobs_survey_form_answers')
export class SurveyFormAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SurveyFormResponse, (r) => r.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'response_id' })
  @Index()
  response: SurveyFormResponse;

  @Column({ name: 'question_id' })
  questionId: number;

  // Denormalized so results stay stable even if the question is later edited.
  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({ name: 'question_type', length: 20 })
  questionType: string;

  @Column({ name: 'value_number', type: 'int', nullable: true })
  valueNumber: number | null;

  @Column({ name: 'value_bool', type: 'boolean', nullable: true })
  valueBool: boolean | null;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText: string | null;

  // For choice questions: string[] of selected options.
  @Column({ name: 'value_choices', type: 'jsonb', nullable: true })
  valueChoices: any;
}
