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
import { Conversation } from './conversation.entity';
import { ParticipantType } from '../enums/chat.enums';

@Entity('chat_conversation_participants')
@Unique('uq_chat_participants_unique', ['conversationId', 'participantType', 'participantEntityId'])
@Index('idx_chat_participants_lookup', ['participantType', 'participantEntityId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'conversation_id', type: 'bigint' })
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'participant_type', type: 'varchar', length: 20 })
  participantType: ParticipantType;

  @Column({ name: 'participant_entity_id' })
  participantEntityId: number;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;
}
