import { Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Survey } from './survey.entity';
import { Job } from '../../job/entities/job.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { Client } from '../../clients/entities/client.entity';
import { SurveyAnswer } from './survey-answer.entity';

@Entity('survey_response')
export class SurveyResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Survey, { nullable: false })
  survey: Survey;

  @ManyToOne(() => Job, { nullable: false })
  job: Job;

  @ManyToOne(() => Worker, { nullable: true })
  worker: Worker;

  @ManyToOne(() => Client, { nullable: true })
  client: Client;

  @CreateDateColumn()
  submittedAt: Date;

  @OneToMany(() => SurveyAnswer, answer => answer.response)
  answers: SurveyAnswer[];
} 