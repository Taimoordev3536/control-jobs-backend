import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Job } from './job.entity';

export enum AlertType {
  SIGN_IN = 'sign_in',
  DELAY = 'delay',
  SIGN_OUT = 'sign_out',
  DURATION = 'duration',
}

@Entity('alert')
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @ManyToOne(() => Job, job => job.alerts, { nullable: false })
  job: Job;

  @Column({ type: 'enum', enum: AlertType })
  alertType: AlertType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  triggerTime: string;

  @Column({ type: 'int', nullable: true })
  minDuration: number;
} 