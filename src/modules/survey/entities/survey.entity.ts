import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Job } from '../../job/entities/job.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { SurveyQuestion } from './survey-question.entity';

@Entity('survey')
export class Survey {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, { nullable: false })
  job: Job;

  @ManyToOne(() => Employer, { nullable: false })
  employer: Employer;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => SurveyQuestion, question => question.survey)
  questions: SurveyQuestion[];
} 