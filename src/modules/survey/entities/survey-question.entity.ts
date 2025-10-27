// import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
// import { Survey } from './survey.entity';
// import { SurveyAnswer } from './survey-answer.entity';

// export enum SurveyQuestionType {
//   TEXT = 'text',
//   RADIO = 'radio',
//   CHECKBOX = 'checkbox',
//   RATING = 'rating',
// }

// @Entity('survey_question')
// export class SurveyQuestion {
//   @PrimaryGeneratedColumn()
//   id: number;

//   @ManyToOne(() => Survey, survey => survey.questions, { nullable: false })
//   survey: Survey;

//   @Column({ type: 'varchar', length: 500 })
//   questionText: string;

//   @Column({ type: 'enum', enum: SurveyQuestionType })
//   questionType: SurveyQuestionType;

//   @Column({ type: 'text', nullable: true })
//   options: string; // JSON or comma-separated for radio/checkbox

//   @Column({ type: 'boolean', default: false })
//   isRequired: boolean;

//   @Column({ type: 'int', default: 0 })
//   order: number;

//   @OneToMany(() => SurveyAnswer, answer => answer.question)
//   answers: SurveyAnswer[];
// } 