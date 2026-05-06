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
 * Snapshot of a single work center attached to an employer at the time an
 * invoice was issued. Used to render "page 2" of the invoice (the names that
 * make up the billed `workcenterCount`).
 *
 * `work_center_id` is intentionally nullable / no-FK so deleting a work
 * center later doesn't cascade and erase historical billing audit trail.
 */
@Entity('cjobs_invoice_workcenters')
export class InvoiceWorkCenter {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_invoice_wc_invoice')
  @Column({ name: 'invoice_id', type: 'bigint' })
  invoiceId: number;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'work_center_id', type: 'bigint', nullable: true })
  workCenterId: number | null;

  @Column({ length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
