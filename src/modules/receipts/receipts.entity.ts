import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity()
export class Receipt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  imageUrl!: string;

  // convert it type to number
  @Column({ type: 'decimal' })
  amount!: number;

  @Column()
  pfrReceiptNumber!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';

  @Column({ nullable: true })
  city!: string;

  @Column({ nullable: true })
  retailStore!: string;

  @Column({ nullable: false })
  userId!: number;

  @ManyToOne(() => User)
  user!: User;

  @Column({ default: 0 })
  pointsAwarded!: number;

  @Column({ nullable: true })
  approvedOrRejectedBy!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ nullable: true })
  rejectionReason?: string; // Optional, no change needed
}
