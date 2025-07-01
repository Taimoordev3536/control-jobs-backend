import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Gender } from '../../../shared/entities/gender.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column({ length: 20, nullable: true })
  landline: string;

  @Column({ length: 20, nullable: true })
  mobile: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 20, nullable: true })
  nif: string;

  @Column({ length: 20, nullable: true })
  naf: string;

  @Column({ length: 100, nullable: true })
  occupation: string;

  @Column({ type: 'date', nullable: true })
  birthday: Date;

  @ManyToOne(() => Gender)
  @JoinColumn({ name: 'gender_id' })
  gender: Gender;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  observation: string;

  @Column({ length: 50, nullable: true })
  asset: string;

  @Column({ name: 'access_account_status', default: 'postpone' })
  accessAccountStatus: 'postpone' | 'request'; 

  // @Column({ type: 'json' })
  // idNumbers: any; // JSON containing nationalId, passport, etc.

  // @Column()
  // position: string;

  // @Column({ type: 'json' })
  // contactInfo: any; // JSON containing phone, email, address, etc.
}
