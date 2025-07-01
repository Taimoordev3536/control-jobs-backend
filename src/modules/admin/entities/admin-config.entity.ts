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

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
