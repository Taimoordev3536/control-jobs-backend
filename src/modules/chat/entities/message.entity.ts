import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';
import { MessageRead } from './message-read.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageAttachment } from './message-attachment.entity';
import { ParticipantType } from '../enums/chat.enums';

@Entity('chat_messages')
@Index('idx_chat_messages_conversation_created', ['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'conversation_id', type: 'bigint' })
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'sender_user_id' })
  senderUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser: User;

  @Column({ name: 'sender_entity_type', type: 'varchar', length: 20 })
  senderEntityType: ParticipantType;

  @Column({ name: 'sender_entity_id' })
  senderEntityId: number;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'replied_to_message_id', type: 'bigint', nullable: true })
  repliedToMessageId: string | null;

  @ManyToOne(() => Message, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replied_to_message_id' })
  repliedToMessage: Message | null;

  @Column({ name: 'pinned_at', type: 'timestamptz', nullable: true })
  pinnedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => MessageRead, (r) => r.message)
  reads: MessageRead[];

  @OneToMany(() => MessageReaction, (r) => r.message)
  reactions: MessageReaction[];

  @OneToMany(() => MessageAttachment, (a) => a.message)
  attachments: MessageAttachment[];
}
