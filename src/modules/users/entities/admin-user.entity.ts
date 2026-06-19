import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

@Entity('cjobs_admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({
    name: 'permission',
    type: 'enum',
    enum: SubUserPermission,
    nullable: true,
  })
  permission: SubUserPermission | null;

  @Column({ name: 'parent_user_id', nullable: true })
  parentUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_user_id' })
  parentUser: User | null;

  @Column({ name: 'nif', length: 20, nullable: true })
  nif: string | null;

  @Column({ name: 'responsible', length: 100, nullable: true })
  responsible: string | null;

  @Column({ name: 'address', length: 255, nullable: true })
  address: string | null;

  @Column({ name: 'street', length: 100, nullable: true })
  street: string | null;

  @Column({ name: 'street_number', length: 20, nullable: true })
  streetNumber: string | null;

  @Column({ name: 'floor_door', length: 50, nullable: true })
  floorDoor: string | null;

  @Column({ name: 'postal_code', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ name: 'city', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'province', length: 100, nullable: true })
  province: string | null;

  @Column({ name: 'country', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  @Column({ name: 'landline', length: 20, nullable: true })
  landline: string | null;

  @Column({ name: 'mobile', length: 20, nullable: true })
  mobile: string | null;

  @Column({ name: 'logo_public_id', length: 255, nullable: true })
  logoPublicId: string | null;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
