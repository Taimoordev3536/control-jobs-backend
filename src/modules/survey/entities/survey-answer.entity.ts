import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { SurveyResponse } from './survey-response.entity';
import { SurveyQuestion } from './survey-question.entity';

@Entity('survey_answer')
export class SurveyAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SurveyResponse, response => response.answers, { nullable: false })
  response: SurveyResponse;

  @ManyToOne(() => SurveyQuestion, question => question.answers, { nullable: false })
  question: SurveyQuestion;

  @Column({ type: 'text', nullable: true })
  answerText: string;
} 