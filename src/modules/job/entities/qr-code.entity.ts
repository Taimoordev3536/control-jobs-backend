import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum QrCodeType {
  STATIC = 'STATIC',
  DYNAMIC = 'DYNAMIC',
}

export enum QrCodeOwnerType {
  CLIENT = 'CLIENT',
  EMPLOYER = 'EMPLOYER',
}

@Entity('qr_codes')
@Index(['ownerType', 'ownerId', 'type'], { unique: true })
@Index(['expiresAt'])
export class QrCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 44 })
  token: string;

  @Column({ type: 'enum', enum: QrCodeType })
  type: QrCodeType;

  @Column({ type: 'enum', enum: QrCodeOwnerType })
  ownerType: QrCodeOwnerType;

  @Column('bigint')
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastRefreshedAt: Date | null;

  @Column({ default: true })
  isActive: boolean;
}
