import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from './job.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';

@Entity('scan_logs')
export class ScanLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'worker_id' })
  workerId: number;

  @Column({ name: 'work_center_id', nullable: true })
  workCenterId?: number;

  @Column({ type: 'varchar', length: 50, default: 'check-in' })
  scanType: string; // 'check-in', 'check-out', 'break-start', 'break-end'

  @Column({ type: 'text', nullable: true })
  location: string; // GPS coordinates or location data

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'scan_time', type: 'timestamptz' })
  scanTime: Date;

  @Column({ type: 'text', nullable: true, name: 'user_timezone' })
  userTimezone?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'signing_method' })
  signingMethod?: string; // 'web', 'ip', 'gps', 'qrcode'

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Column({ type: 'text', nullable: true, name: 'qr_token' })
  qrToken?: string;

  @Column({ type: 'text', nullable: true, name: 'selfie_url' })
  selfieUrl?: string | null; // identity-verification selfie (when job.verifyIdentity is on)

  @Column({ type: 'boolean', name: 'webauthn_verified', default: false })
  webauthnVerified: boolean; // device biometric (WebAuthn) verified this check-in

  @Column({ type: 'boolean', name: 'location_unavailable', default: false })
  locationUnavailable: boolean; // worker checked in without location (blocked/denied) — needs review

  @Column({ type: 'varchar', length: 20, default: 'SCAN' })
  source: string; // 'SCAN' (normal real-time) or 'MANUAL' (from approved manual request)

  // Relations
  @ManyToOne(() => Job, job => job.scanLogs)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Worker, worker => worker.scanLogs)
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @ManyToOne(() => WorkCenter, { nullable: true })
  @JoinColumn({ name: 'work_center_id' })
  workCenter?: WorkCenter;
}
