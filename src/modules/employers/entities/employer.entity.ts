// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   JoinColumn,
//   CreateDateColumn,
//   UpdateDateColumn,
//   OneToMany,
// } from 'typeorm';
// import { Partner } from '../../partners/entities/partner.entity';
// import { EmployerType } from './employer-type.entity';
// import { EmployerSubType } from './employer-sub-type.entity';
// import { PaymentMethod } from '../../../shared/entities/payment-method.entity';
// import { EmployerUser } from './employer-user.entity';

// @Entity('cjobs_empleadores')
// export class Employer {
//   @PrimaryGeneratedColumn()
//   id: number;

//   @ManyToOne(() => Partner)
//   @JoinColumn({ name: 'partnerId' })
//   partner: Partner;

//   @Column()
//   partnerId: number;

//   @Column()
//   name: string;

//   @Column()
//   taxId: string;

//   @Column()
//   address: string;

//   @Column({ nullable: true })
//   phone: string;

//   @Column({ nullable: true })
//   mobile: string; // ✅ New field from UI

//   @Column({ nullable: true })
//   landline: string;

//   @Column({ nullable: false }) // Made required based on UI
//   email: string; // ✅ New required field from UI

//   @ManyToOne(() => EmployerType)
//   @JoinColumn({ name: 'typeId' })
//   type: EmployerType;

//   @Column()
//   typeId: number;

//   @ManyToOne(() => EmployerSubType)
//   @JoinColumn({ name: 'subTypeId' })
//   subType: EmployerSubType;

//   @Column()
//   subTypeId: number;

//   @Column('decimal', { precision: 5, scale: 2 })
//   fee: number;

//   @Column('decimal', { precision: 5, scale: 2, nullable: true })
//   discount: number;

//   @ManyToOne(() => PaymentMethod)
//   @JoinColumn({ name: 'paymentMethodId' })
//   paymentMethod: PaymentMethod;

//   @Column()
//   paymentMethodId: number;

//   @Column({ nullable: true })
//   accountIban: string;

//   @Column({ nullable: true })
//   bicSwift: string;

//   @Column({ nullable: true })
//   probationPeriod: string;

//   @Column({ nullable: true })
//   responsible: string; // ✅ New field from UI

//   @Column({ nullable: true })
//   accessAccountStatus: 'postpone' | 'request'; // ✅ New field from UI

//   @OneToMany(() => EmployerUser, (employerUser) => employerUser.employer)
//   employerUsers: EmployerUser[];

//   @CreateDateColumn({ name: 'created_at' })
//   createdAt: Date;

//   @UpdateDateColumn({ name: 'updated_at' })
//   updatedAt: Date;
// }

// src/employers/entities/employer.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Partner } from '../../partners/entities/partner.entity';
import { EmployerType } from './employer-type.entity';
import { EmployerSubType } from './employer-sub-type.entity';
import { PaymentMethod } from '../../../shared/entities/payment-method.entity';
import { EmployerUser } from './employer-user.entity';

@Entity('cjobs_empleadores')
export class Employer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

  @Column()
  partnerId: number;

  @Column()
  name: string;

  @Column()
  taxId: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  mobile: string;

  @Column({ nullable: true })
  landline: string;

  // REMOVED: email field from Employer Entity
  // @Column({ nullable: false })
  // email: string;

  @ManyToOne(() => EmployerType)
  @JoinColumn({ name: 'typeId' })
  type: EmployerType;

  @Column()
  typeId: number;

  @ManyToOne(() => EmployerSubType)
  @JoinColumn({ name: 'subTypeId' })
  subType: EmployerSubType;

  @Column()
  subTypeId: number;

  @Column('decimal', { precision: 5, scale: 2 })
  fee: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  discount: number;

  @ManyToOne(() => PaymentMethod)
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: PaymentMethod;

  @Column()
  paymentMethodId: number;

  @Column({ nullable: true })
  accountIban: string;

  @Column({ nullable: true })
  bicSwift: string;

  @Column({ nullable: true })
  probationPeriod: string;

  @Column({ nullable: true })
  responsible: string;

  @Column({ nullable: true })
  accessAccountStatus: 'postpone' | 'request';

  @OneToMany(() => EmployerUser, (employerUser) => employerUser.employer)
  employerUsers: EmployerUser[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
