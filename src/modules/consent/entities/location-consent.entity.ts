import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * A worker's GDPR consent to have their geolocation captured during check-in.
 * One row per user; `granted` flips on grant/revoke and the timestamps track when.
 */
@Entity('location_consents')
export class LocationConsent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'user_id', type: 'integer', unique: true })
  userId: number;

  @Column({ type: 'boolean', default: false })
  granted: boolean;

  /** Version of the consent text the worker agreed to (bump when the wording changes). */
  @Column({ name: 'consent_version', type: 'varchar', length: 20, default: '1' })
  consentVersion: string;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: true })
  grantedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
