// payment-method.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Partner } from '../../modules/partners/entities/partner.entity';

@Entity('cjobs_paymentMethods')
export class PaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'is_self_service', default: false })
  isSelfService: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @OneToMany(() => Partner, partner => partner.defaultPaymentMethod)
  partners: Partner[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}