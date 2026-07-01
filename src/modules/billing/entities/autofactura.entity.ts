import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Partner } from '../../partners/entities/partner.entity';
import { AutofacturaLine } from './autofactura-line.entity';
import { AutofacturaSource } from './autofactura-source.entity';

export type AutofacturaStatus = 'PENDING' | 'PAID' | 'CANCELLED';

@Entity('cjobs_autofacturas')
export class Autofactura {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'autofactura_number', length: 60 })
  autofacturaNumber: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @Column({ name: 'partner_id' })
  partnerId: number;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal: string;

  @Column({ name: 'retention_pct', type: 'numeric', precision: 5, scale: 2, default: 0 })
  retentionPct: string;

  @Column({ name: 'retention_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  retentionAmount: string;

  @Column({ name: 'vat_pct', type: 'numeric', precision: 5, scale: 2, default: 21 })
  vatPct: string;

  @Column({ name: 'vat_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  vatAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total: string;

  @Column({ length: 20, default: 'PENDING' })
  status: AutofacturaStatus;

  @Column({ name: 'is_manual', default: false })
  isManual: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => AutofacturaLine, (l) => l.autofactura)
  lines: AutofacturaLine[];

  @OneToMany(() => AutofacturaSource, (s) => s.autofactura)
  sources: AutofacturaSource[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
