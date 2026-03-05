import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { PartnerTier } from './partner-type.entity';
import { PaymentMethod } from '../../../shared/entities/payment-method.entity';
import { PartnerUser } from './partner-user.entity';
import { PartnerType, PaymentMethodEnum } from '../dto/create-partner.dto';

@Entity('cjobs_partners')
export class Partner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'address', length: 255 })
  address: string;

  @Column({ name: 'street', length: 100, nullable: true })
  street: string;

  @Column({ name: 'street_number', length: 20, nullable: true })
  streetNumber: string;

  @Column({ name: 'floor_door', length: 50, nullable: true })
  floorDoor: string;

  @Column({ name: 'postal_code', length: 20, nullable: true })
  postalCode: string;

  @Column({ name: 'city', length: 100, nullable: true })
  city: string;

  @Column({ name: 'province', length: 100, nullable: true })
  province: string;

  @Column({ name: 'country', length: 100, nullable: true })
  country: string;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  @Column({ length: 20, nullable: true })
  landline: string; // ✅ New field from UI

  @Column({ length: 20, nullable: true })
  mobile: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ name: 'nif', length: 20 })
  taxId: string;

  @Column({
    name: 'type_of_partner',
    type: 'enum',
    enum: PartnerType,
    nullable: true,
  })
  typeOfPartner: PartnerType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commission: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  retention: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethodEnum,
    nullable: true,
  })
  paymentMethod: PaymentMethodEnum;

  @Column({ name: 'account_iban', length: 50, nullable: true })
  accountIban: string;

  @Column({ name: 'bic_swift', length: 20, nullable: true })
  bicSwift: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ name: 'partner_tier_id' })
  partnerTierId: number;

  @ManyToOne(() => PartnerTier)
  @JoinColumn({ name: 'partner_tier_id' })
  partnerTier: PartnerTier;

  @Column({ name: 'default_payment_method_id', nullable: true })
  defaultPaymentMethodId: number;

  @ManyToOne(() => PaymentMethod)
  @JoinColumn({ name: 'default_payment_method_id' })
  defaultPaymentMethod: PaymentMethod;

  @OneToMany(() => Employer, (employer) => employer.partner)
  employers: Employer[];

  @OneToMany(() => PartnerUser, (partnerUser) => partnerUser.partner)
  partnerUsers: PartnerUser[];

  @Column({ length: 100, nullable: true })
  responsible: string; // ✅ New field from UI

  @Column({ name: 'access_account_status', default: 'postpone' })
  accessAccountStatus: 'postpone' | 'request'; // ✅ New field from UI

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
