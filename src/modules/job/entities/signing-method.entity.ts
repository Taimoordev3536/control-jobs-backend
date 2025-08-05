import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Job } from './job.entity';

export enum SigningMethodType {
  MOBILE = 'mobile',
  PC = 'pc',
  CALL = 'call',
}

export enum SigningMethodDetail {
  QRCODE = 'qrcode',
  WIFI = 'wifi',
  GPS = 'gps',
  NFC = 'nfc',
  IP = 'ip',
  CALLERID = 'callerid',
}

@Entity('signing_method')
export class SigningMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, job => job.signingMethods, { nullable: false })
  job: Job;

  @Column({ type: 'enum', enum: SigningMethodType })
  methodType: SigningMethodType;

  @Column({ type: 'simple-array' })
  methodDetails: SigningMethodDetail[];

  @Column({ type: 'boolean', default: false })
  verifyIdentity: boolean;
} 