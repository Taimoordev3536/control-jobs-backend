import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cloud_connections')
export class CloudConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  provider: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'account_email', nullable: true })
  accountEmail: string | null;

  @Column({ name: 'folder_id', type: 'text', nullable: true })
  folderId: string | null;

  @CreateDateColumn({ name: 'connected_at' })
  connectedAt: Date;
}
