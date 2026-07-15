import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, OneToMany, JoinColumn, Index } from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { Client } from '../../clients/entities/client.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { Shift } from './shift.entity';
import { SeasonPeriod } from './season-period.entity';
import { SigningMethod } from './signing-method.entity';
import { Alert } from './alert.entity';
import { Task } from './task.entity';
import { Survey } from '../../survey/entities/survey.entity';
import { User } from '../../users/entities/user.entity';
import { ScanLog } from './scan-log.entity';
import { WorkSession } from './work-session.entity';
import { JobStatus } from '../enums/job-status.enum';
import { ScheduleType } from './shift.entity';
import { SeasonalSchedule } from './seasonal-schedule.entity';
import { TaskHistory } from './task-history.entity';

@Entity('job')
@Index('idx_job_employer_status', ['employer', 'status'])
@Index('idx_job_client', ['client'])
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

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
  
  // Support multiple work centers per job
  @ManyToMany(() => WorkCenter)
  @JoinTable({
    name: 'job_work_centers',
    joinColumn: {
      name: 'job_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'work_center_id',
      referencedColumnName: 'id',
    },
  })
  workCenters?: WorkCenter[];

  @Column({ type: 'varchar', length: 255 })
  jobName: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'enum', enum: ScheduleType, enumName: 'schedule_type_enum', nullable: false, default: ScheduleType.FREE })
  scheduleType: ScheduleType;

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

  // Shifts are now organized under SeasonalSchedule; use seasonalSchedules relation instead.

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

  @OneToMany(() => SeasonalSchedule, (ss) => ss.job, { cascade: true })
  seasonalSchedules: SeasonalSchedule[];
} 