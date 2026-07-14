import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';

export enum QrCodeType {
  STATIC = 'STATIC',
  DYNAMIC = 'DYNAMIC',
}

@Entity('qr_codes')
@Index(['workCenterId', 'type', 'isActive'], { unique: true, where: '"isActive" = true' })
@Index(['expiresAt'])
@Index(['workCenterId'])
export class QrCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 44 })
  token: string;

  @Column({ type: 'enum', enum: QrCodeType })
  type: QrCodeType;

  @Column({ name: 'work_center_id' })
  workCenterId: number;

  @ManyToOne(() => WorkCenter, { nullable: false })
  @JoinColumn({ name: 'work_center_id' })
  workCenter: WorkCenter;

  @Column({ name: 'is_selected', default: false })
  isSelected: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRefreshedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
