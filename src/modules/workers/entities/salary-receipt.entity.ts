import {
  OneToMany,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Worker } from './worker.entity';
import { PaymentMethod } from '../../../shared/entities/payment-method.entity';
import { SalaryReceiptLine } from './salary-receipt-line.entity';

@Entity('cjobs_salary_receipts')
export class SalaryReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'worker_id' })
  workerId: number;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @Column({ name: 'employer_id' })
  employerId: number;

  @Column({ name: 'receipt_number', length: 60 })
  receiptNumber: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'fixed_label', length: 120, default: 'Gastos fijos' })
  fixedLabel: string;

  @Column({ name: 'fixed_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  fixedAmount: string | null;

  @Column({ name: 'hours_label', length: 120, default: 'Horas de trabajo' })
  hoursLabel: string;

  @Column({ name: 'hours_qty', type: 'numeric', precision: 10, scale: 2, default: 0 })
  hoursQty: string;

  // What the clock recorded, kept beside hoursQty so any manual reduction
  // is visible rather than silent.
  @Column({ name: 'computed_hours_qty', type: 'numeric', precision: 10, scale: 2, nullable: true })
  computedHoursQty: string | null;

  @Column({ name: 'hour_rate', type: 'numeric', precision: 12, scale: 2, default: 0 })
  hourRate: string;

  @Column({ name: 'hours_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  hoursAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total: string;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId: number | null;

  @ManyToOne(() => PaymentMethod, { nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethod | null;

  @Column({ name: 'uploaded_by_user_id', nullable: true })
  uploadedByUserId: number | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @OneToMany(() => SalaryReceiptLine, (l) => l.receipt)
  lines?: SalaryReceiptLine[];

}
