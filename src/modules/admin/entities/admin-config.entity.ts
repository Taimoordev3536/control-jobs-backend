import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('admin_config')
export class AdminConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  companyName: string;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  vatRate: number;

  @Column()
  invoiceSeries: string;

  @Column()
  paymentDetails: string;

  @Column({ name: 'iva_text_particulares_tai', type: 'text', nullable: true })
  ivaTextParticularesTai: string | null;

  @Column({ name: 'iva_text_autonomos_fuera_tai', type: 'text', nullable: true })
  ivaTextAutonomosFueraTai: string | null;

  @Column({ name: 'iban', type: 'varchar', length: 50, nullable: true })
  iban: string | null;

  @Column({ name: 'swift_bic', type: 'varchar', length: 50, nullable: true })
  swiftBic: string | null;

  @Column({ name: 'paypal', type: 'varchar', length: 255, nullable: true })
  paypal: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
