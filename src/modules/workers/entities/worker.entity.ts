import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Gender } from '../../../shared/entities/gender.entity';
import { User } from '../../users/entities/user.entity';
import { ScanLog } from '../../job/entities/scan-log.entity';
import { WorkSession } from '../../job/entities/work-session.entity';
import { TaskHistory } from '../../job/entities/task-history.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column({ length: 20, nullable: true })
  landline: string;

  @Column({ length: 20, nullable: true })
  mobile: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 20, nullable: true })
  nif: string;

  @Column({ length: 20, nullable: true })
  naf: string;

  @Column({ length: 100, nullable: true })
  occupation: string;

  @Column({ type: 'date', nullable: true })
  birthday: Date;

  @ManyToOne(() => Gender)
  @JoinColumn({ name: 'gender_id' })
  gender: Gender;

@ManyToOne(() => User)
@JoinColumn({ name: 'user_id' }) // assuming foreign key column is user_id
user: User;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  observation: string;

  @Column({ length: 50, nullable: true })
  asset: string;

  @Column({ name: 'access_account_status', default: 'postpone' })
  accessAccountStatus: 'postpone' | 'request'; 

  // Relations
  @OneToMany(() => ScanLog, scanLog => scanLog.worker)
  scanLogs: ScanLog[];

  @OneToMany(() => WorkSession, workSession => workSession.worker)
  workSessions: WorkSession[];

   @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.completedBy)
  taskHistories: TaskHistory[];
}
