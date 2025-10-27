import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { SurveyResponse } from './survey-response.entity';

@Entity('survey_answer')
export class SurveyAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SurveyResponse, response => response.answers, { nullable: false })
  response: SurveyResponse;

  // Index of the question within the survey.questions array (0-based)
  @Column({ type: 'int', nullable: true })
  questionIndex: number | null;

  // Cached question text at the time of response for denormalization and history
  @Column({ type: 'text', nullable: true })
  questionText: string | null;

  @Column({ type: 'text', nullable: true })
  answerText: string;
}