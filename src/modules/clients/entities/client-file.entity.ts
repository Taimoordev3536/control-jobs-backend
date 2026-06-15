import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('cjobs_client_files')
export class ClientFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'client_id' })
  clientId: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ type: 'text' })
  url: string;

  // Cloudinary public_id + resource_type, needed to delete the asset.
  @Column({ name: 'storage_public_id', length: 500 })
  storagePublicId: string;

  @Column({ name: 'resource_type', length: 20, default: 'raw' })
  resourceType: string;

  @Column({ name: 'mime_type', length: 150, nullable: true })
  mimeType: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'uploaded_by_user_id', nullable: true })
  uploadedByUserId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
