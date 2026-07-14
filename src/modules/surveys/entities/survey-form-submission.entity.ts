import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

// Tracks WHO submitted a survey — kept separate from the response content so
// that anonymous surveys can still prevent double-submission and hide a filled
// survey, without linking the respondent's identity to their answers.
@Entity('cjobs_survey_form_submissions')
@Unique(['formId', 'userId'])
export class SurveyFormSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'form_id' })
  @Index()
  formId: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;
}
