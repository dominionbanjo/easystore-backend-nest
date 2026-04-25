import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';

import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingController } from './messaging.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, MessageRead]),

    // JwtModule is needed by the gateway for handshake token verification
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
