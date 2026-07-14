import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** A WebAuthn (passkey / device biometric) credential registered by a user. */
@Entity('device_credentials')
export class DeviceCredential {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** Relying-Party ID (domain) this credential was registered for. Passkeys are domain-bound,
   * so a localhost credential is not valid on the live domain — filter by the current rpID. */
  @Column({ name: 'rp_id', type: 'varchar', length: 255, nullable: true })
  rpId: string | null;

  /** base64url credential ID returned by the authenticator */
  @Column({ name: 'credential_id', type: 'varchar', length: 500, unique: true })
  credentialId: string;

  /** base64-encoded COSE public key */
  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ type: 'bigint', default: 0 })
  counter: string; // bigint → string in TypeORM

  @Column({ type: 'text', nullable: true })
  transports: string | null;

  @Column({ name: 'device_label', type: 'varchar', length: 120, nullable: true })
  deviceLabel: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
