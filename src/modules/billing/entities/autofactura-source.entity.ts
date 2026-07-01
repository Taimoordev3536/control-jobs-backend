import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Autofactura } from './autofactura.entity';

@Entity('cjobs_autofactura_sources')
export class AutofacturaSource {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_autofactura_source_parent')
  @Column({ name: 'autofactura_id', type: 'bigint' })
  autofacturaId: number;

  @ManyToOne(() => Autofactura, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'autofactura_id' })
  autofactura: Autofactura;

  // INDIVIDUAL | FREELANCER | COMPANY (→ Particulares | Autónomos | Empresas)
  @Column({ name: 'employer_type', length: 20, nullable: true })
  employerType: string | null;

  @Column({ name: 'employer_name', length: 255, nullable: true })
  employerName: string | null;

  @Column({ name: 'invoice_number', length: 60, nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  commission: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discount: string;

  @Column({ name: 'total_commission', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCommission: string;
}
