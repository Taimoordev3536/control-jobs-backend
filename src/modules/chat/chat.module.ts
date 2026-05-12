import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../users/entities/admin-user.entity';
import { User } from '../users/entities/user.entity';
import { Partner } from '../partners/entities/partner.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { PartnerTier } from '../partners/entities/partner-type.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Conversation,
      ConversationParticipant,
      Message,
      MessageRead,
      MessageReaction,
      MessageAttachment,
      User,
      AdminUser,
      Partner,
      PartnerUser,
      PartnerTier,
      Employer,
      EmployerUser,
      EmployerClient,
      EmployerWorker,
      Client,
      ClientUser,
      Worker,
      WorkerUser,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    CloudinaryModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
