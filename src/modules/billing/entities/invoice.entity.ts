import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { PaymentMethod } from '../../../shared/entities/payment-method.entity';
import { InvoiceWorkCenter } from './invoice-workcenter.entity';
import { InvoiceWorker } from './invoice-worker.entity';
import { InvoiceLine } from './invoice-line.entity';

export type InvoiceStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';

export type InvoiceType = 'NORMAL' | 'RECTIFICATIVA';

@Entity('cjobs_invoices')
// Once-per-period unique applies only to auto invoices; manual ones are exempt.
@Index('uq_invoices_employer_period', ['employerId', 'periodStart'], {
  unique: true,
  where: 'is_manual = false',
})
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

  @Column({ name: 'invoice_type', length: 20, default: 'NORMAL' })
  invoiceType: InvoiceType;

  @Column({ name: 'is_manual', default: false })
  isManual: boolean;

  @Column({ name: 'rectifies_invoice_id', type: 'bigint', nullable: true })
  rectifiesInvoiceId: number | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'charge_date', type: 'date', nullable: true })
  chargeDate: string | null;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId: number | null;

  @ManyToOne(() => PaymentMethod, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // "Page 2" snapshots — populated by InvoiceService.createForEmployer at
  // the moment the invoice is issued. Historical: a later removal of a work
  // center or worker doesn't erase what was billed for.
  @OneToMany(() => InvoiceWorkCenter, (row) => row.invoice)
  workCenters: InvoiceWorkCenter[];

  @OneToMany(() => InvoiceWorker, (row) => row.invoice)
  workers: InvoiceWorker[];

  @OneToMany(() => InvoiceLine, (row) => row.invoice)
  lines: InvoiceLine[];
}
