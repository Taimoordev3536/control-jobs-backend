import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';

/**
 * Snapshot of a single worker attached to an employer at the time an
 * invoice was issued. Used on "page 2" of the invoice so partners (Gold /
 * Silver) can audit the headcount that drove the billed total.
 *
 * `worker_id` is no-FK on purpose — historical invoices keep their list
 * even if a worker is later removed from the system.
 */
@Entity('cjobs_invoice_workers')
export class InvoiceWorker {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_invoice_wk_invoice')
  @Column({ name: 'invoice_id', type: 'bigint' })
  invoiceId: number;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'worker_id', type: 'bigint', nullable: true })
  workerId: number | null;

  @Column({ length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
