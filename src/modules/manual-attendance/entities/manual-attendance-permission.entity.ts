import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from '../../job/entities/job.entity';
import { Client } from '../../clients/entities/client.entity';
import { Employer } from '../../employers/entities/employer.entity';

@Entity('manual_attendance_permissions')
export class ManualAttendancePermission {
  @PrimaryGeneratedColumn()
  id: number;

  // Scope - only ONE of these should be set
  @Column({ name: 'job_id', nullable: true, unique: true })
  jobId?: number;

  @Column({ name: 'client_id', nullable: true, unique: true })
  clientId?: number;

  @Column({ name: 'employer_id', nullable: true, unique: true })
  employerId?: number;

  // Master toggle
  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;

  // Who can create requests
  @Column({ name: 'worker_can_request', type: 'boolean', default: true })
  workerCanRequest: boolean;

  @Column({ name: 'employer_can_create', type: 'boolean', default: true })
  employerCanCreate: boolean;

  @Column({ name: 'client_can_create', type: 'boolean', default: false })
  clientCanCreate: boolean;

  // Limits
  @Column({ name: 'max_retroactive_days', type: 'int', default: 7 })
  maxRetroactiveDays: number;

  @Column({ name: 'max_requests_per_worker_month', type: 'int', default: 10 })
  maxRequestsPerWorkerMonth: number;

  // Requirements
  @Column({ name: 'require_reason', type: 'boolean', default: true })
  requireReason: boolean;

  // Timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job, { nullable: true })
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: Client;

  @ManyToOne(() => Employer, { nullable: true })
  @JoinColumn({ name: 'employer_id' })
  employer?: Employer;
}
