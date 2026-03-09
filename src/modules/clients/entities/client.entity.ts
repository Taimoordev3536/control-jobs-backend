import { Entity, PrimaryGeneratedColumn, Column, Generated } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

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

  @Column({ default: true })
  active: boolean;
}
