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

@Entity('chat_message_reads')
@Unique('uq_chat_message_reads_unique', ['messageId', 'userId'])
@Index('idx_chat_message_reads_user', ['userId', 'messageId'])
export class MessageRead {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'message_id', type: 'bigint' })
  messageId: string;

  @ManyToOne(() => Message, (m) => m.reads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;
}
