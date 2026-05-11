import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Message } from './message.entity';

@Entity('chat_message_reactions')
@Unique('uq_chat_message_reactions_unique', ['messageId', 'userId', 'emoji'])
@Index('idx_chat_message_reactions_message', ['messageId'])
export class MessageReaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'message_id', type: 'bigint' })
  messageId: string;

  @ManyToOne(() => Message, (m) => m.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 16 })
  emoji: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
