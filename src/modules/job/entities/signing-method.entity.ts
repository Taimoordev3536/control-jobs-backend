import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Job } from './job.entity';

export enum SigningMethodType {
  MOBILE = 'mobile',
  PC = 'pc',
}

export enum SigningMethodDetail {
  WEB = 'web',
  IP = 'ip',
  GPS = 'gps',
  QRCODE = 'qrcode',
}

@Entity('signing_method')
export class SigningMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, (job) => job.signingMethods, { nullable: false, onDelete: 'CASCADE' })
  job: Job;

  // "mobile" or "laptop"
  @Column({ type: 'enum', enum: SigningMethodType })
  methodType: SigningMethodType;

  // e.g., ['web', 'gps', 'qrcode']
  @Column({ type: 'simple-array', nullable: true })
  methodDetails: SigningMethodDetail[];

  // Identity verification toggle
  @Column({ type: 'boolean', default: false })
  verifyIdentity: boolean;
}
