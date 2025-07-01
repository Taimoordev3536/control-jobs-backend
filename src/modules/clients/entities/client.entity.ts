import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string;

  @Column()
  status: string;

  @Column()
  code: string;

  @Column()
  taxId: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  landline: string;

  @Column({ nullable: true })
  mobile: string;

  @Column({ nullable: true })
  observation: string;

  @Column({ nullable: true })
  responsible: string;

  @Column({ name: 'winter_schedule', nullable: true })
  winterSchedule: string;

  @Column({ name: 'summer_schedule', nullable: true })
  summerSchedule: string;

  @Column({ name: 'access_account_status', default: 'postpone' })
  accessAccountStatus: 'postpone' | 'request'; // ✅ New field from UI

  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true })
  name: string;
}
