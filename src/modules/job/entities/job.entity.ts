import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, OneToMany, JoinColumn } from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { Client } from '../../clients/entities/client.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { Shift } from './shift.entity';
import { SigningMethod } from './signing-method.entity';
import { Alert } from './alert.entity';
import { Task } from './task.entity';
import { Survey } from '../../survey/entities/survey.entity';
import { User } from '../../users/entities/user.entity';
import { ScanLog } from './scan-log.entity';
import { WorkSession } from './work-session.entity';
import { JobStatus } from '../enums/job-status.enum';
import { TaskHistory } from './task-history.entity';

@Entity('job')
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  // @Column()
  // employerId: number;

  // @Column()
  // clientId: number;

  // @Column()
  // workCenterId: number;

  @ManyToOne(() => User)
@JoinColumn({ name: "user_id" })
user: User;


  @ManyToOne(() => Employer, { nullable: false })
  @JoinColumn({ name: 'employerId' })
  employer: Employer;
  
  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'clientId' })
  client?: Client | null;
  
  @ManyToOne(() => WorkCenter, { nullable: true })
  @JoinColumn({ name: 'workCenterId' })
  workCenter?: WorkCenter | null;

  @Column({ type: 'varchar', length: 255 })
  jobName: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @ManyToMany(() => Worker)
  @JoinTable({ name: 'job_workers' })
  workers: Worker[];

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.SCHEDULED
  })
  status: JobStatus;

  @OneToMany(() => Shift, shift => shift.job)
  shifts: Shift[];

  @OneToMany(() => SigningMethod, signingMethod => signingMethod.job)
  signingMethods: SigningMethod[];

  @OneToMany(() => Alert, alert => alert.job)
  alerts: Alert[];

  @OneToMany(() => Task, task => task.job)
  tasks: Task[];

  @OneToMany(() => Survey, survey => survey.job)
  surveys: Survey[];

  @OneToMany(() => ScanLog, scanLog => scanLog.job)
  scanLogs: ScanLog[];

  @OneToMany(() => WorkSession, workSession => workSession.job)
  workSessions: WorkSession[];

  @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.job)
  taskHistories: TaskHistory[];
} 