import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ClientInvoice } from './client-invoice.entity';

// Extra concept on a client invoice, beyond the fixed + hours pair.
@Entity('cjobs_client_invoice_lines')
export class ClientInvoiceLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_invoice_id_lines')
  @Column({ name: 'invoice_id' })
  invoiceId: number;

  @ManyToOne(() => ClientInvoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: ClientInvoice;

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
