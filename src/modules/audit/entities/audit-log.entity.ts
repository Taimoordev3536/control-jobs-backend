import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'actor_user_id', nullable: true })
  actorUserId: number;

  @Column({ name: 'actor_name', nullable: true })
  actorName: string;

  @Column({ name: 'actor_role', nullable: true })
  actorRole: string;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
