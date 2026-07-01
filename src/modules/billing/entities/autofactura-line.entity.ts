import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Autofactura } from './autofactura.entity';

@Entity('cjobs_autofactura_lines')
export class AutofacturaLine {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_autofactura_line_parent')
  @Column({ name: 'autofactura_id', type: 'bigint' })
  autofacturaId: number;

  @ManyToOne(() => Autofactura, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'autofactura_id' })
  autofactura: Autofactura;

  @Column({ length: 500 })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amount: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
