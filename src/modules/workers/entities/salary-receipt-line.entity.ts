import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SalaryReceipt } from './salary-receipt.entity';

// Extra concept on a receipt, beyond the fixed + hours pair.
@Entity('cjobs_salary_receipt_lines')
export class SalaryReceiptLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_receipt_id_lines')
  @Column({ name: 'receipt_id' })
  receiptId: number;

  @ManyToOne(() => SalaryReceipt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: SalaryReceipt;

  @Column({ length: 500 })
  description: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  quantity: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2 })
  lineTotal: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
