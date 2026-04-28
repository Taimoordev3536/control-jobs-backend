import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';

export type InvoiceStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';

@Entity('cjobs_invoices')
@Index('uq_invoices_employer_period', ['employerId', 'periodStart'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'invoice_number', length: 50, unique: true })
  invoiceNumber: string;

  @ManyToOne(() => Employer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employer_id' })
  employer: Employer;

  @Column({ name: 'employer_id' })
  employerId: number;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'is_prorated', default: false })
  isProrated: boolean;

  @Column({ name: 'prorated_days', nullable: true })
  proratedDays: number | null;

  @Column({ name: 'days_in_month', nullable: true })
  daysInMonth: number | null;

  @Column({ name: 'monthly_fixed_rate', type: 'decimal', precision: 8, scale: 2 })
  monthlyFixedRate: number;

  @Column({ name: 'per_workcenter_rate', type: 'decimal', precision: 8, scale: 2 })
  perWorkCenterRate: number;

  @Column({ name: 'per_worker_rate', type: 'decimal', precision: 8, scale: 2 })
  perWorkerRate: number;

  @Column({ name: 'fixed_amount', type: 'decimal', precision: 10, scale: 2 })
  fixedAmount: number;

  @Column({ name: 'workcenter_count' })
  workcenterCount: number;

  @Column({ name: 'workcenter_amount', type: 'decimal', precision: 10, scale: 2 })
  workcenterAmount: number;

  @Column({ name: 'worker_count' })
  workerCount: number;

  @Column({ name: 'worker_amount', type: 'decimal', precision: 10, scale: 2 })
  workerAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ name: 'discount_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPct: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'vat_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  vatPct: number;

  @Column({ name: 'vat_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ length: 20, default: 'PENDING' })
  status: InvoiceStatus;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
