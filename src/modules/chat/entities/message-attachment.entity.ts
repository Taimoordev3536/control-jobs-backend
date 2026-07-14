import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { AttachmentKind } from '../enums/chat.enums';

@Entity('chat_message_attachments')
@Index('idx_chat_message_attachments_msg', ['messageId', 'position'])
export class MessageAttachment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'message_id', type: 'bigint' })
  messageId: string;

  @ManyToOne(() => Message, (m) => m.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ type: 'varchar', length: 20 })
  kind: AttachmentKind;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'cloudinary_id', type: 'varchar', length: 255 })
  cloudinaryId: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 80, nullable: true })
  mimeType: string | null;

  @Column({ name: 'size_bytes', type: 'int', nullable: true })
  sizeBytes: number | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ name: 'original_name', type: 'varchar', length: 255, nullable: true })
  originalName: string | null;

  @Column({ type: 'smallint', default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
