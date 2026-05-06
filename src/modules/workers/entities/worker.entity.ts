import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Generated } from 'typeorm';
import { Gender } from '../../../shared/entities/gender.entity';
import { User } from '../../users/entities/user.entity';
import { ScanLog } from '../../job/entities/scan-log.entity';
import { WorkSession } from '../../job/entities/work-session.entity';
import { TaskHistory } from '../../job/entities/task-history.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column()
  code: string;

  @Column({ length: 20, nullable: true })
  landline: string;

  @Column({ length: 20, nullable: true })
  mobile: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ name: 'street', length: 100, nullable: true })
  street: string;

  @Column({ name: 'street_number', length: 20, nullable: true })
  streetNumber: string;

  @Column({ name: 'floor_door', length: 50, nullable: true })
  floorDoor: string;

  @Column({ name: 'postal_code', length: 20, nullable: true })
  postalCode: string;

  @Column({ name: 'city', length: 100, nullable: true })
  city: string;

  @Column({ name: 'province', length: 100, nullable: true })
  province: string;

  @Column({ name: 'country', length: 100, nullable: true })
  country: string;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

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

  @Column({ name: 'logo_public_id', length: 255, nullable: true })
  logoPublicId: string | null;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string | null;

  // Relations
  @OneToMany(() => ScanLog, scanLog => scanLog.worker)
  scanLogs: ScanLog[];

  @OneToMany(() => WorkSession, workSession => workSession.worker)
  workSessions: WorkSession[];

   @OneToMany(() => TaskHistory, (taskHistory) => taskHistory.completedBy)
  taskHistories: TaskHistory[];
}
