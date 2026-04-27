import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  /* ══════════════════════════════════════════════
     PUBLIC CHATROOM
  ══════════════════════════════════════════════ */

  /**
   * GET /messaging/chatroom
   * Fetch paginated chatroom messages (newest last)
   */
  @Get('chatroom')
  async getChatroomMessages(@Query() dto: GetMessagesDto) {
    const result = await this.messagingService.getChatroomMessages(dto);
    return { message: 'Chatroom messages fetched', data: result };
  }

  /**
   * POST /messaging/chatroom
   * Send a message to the public chatroom
   */
  @Post('chatroom')
  async sendChatroomMessage(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendChatroomMessage(
      user.sub,
      dto,
    );

    // Broadcast to all chatroom subscribers
    this.messagingGateway.emitChatroomMessage(message);

    return { message: 'Message sent', data: message };
  }

  /**
   * GET /messaging/chatroom/status
   * How many users are currently in the chatroom
   */
  @Get('chatroom/status')
  getChatroomStatus() {
    return {
      message: 'Chatroom status',
      data: { online_count: this.messagingGateway.getChatroomCount() },
    };
  }

  /**
   * POST /messaging/chatroom/:messageId/read
   * Mark a chatroom message as read by current user
   */
  @Post('chatroom/:messageId/read')
  async markChatroomMessageRead(
    @Param('messageId') messageId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    await this.messagingService.markChatroomMessageRead(messageId, user.sub);
    return { message: 'Message marked as read' };
  }

  /* ══════════════════════════════════════════════
     CONVERSATIONS
  ══════════════════════════════════════════════ */

  /**
   * GET /messaging/conversations
   * List all conversations for the current user
   */
  @Get('conversations')
  async getUserConversations(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const data = await this.messagingService.getUserConversations(user.sub);
    return { message: 'Conversations fetched', data };
  }

  /**
   * POST /messaging/conversations
   * Start a 1-to-1 conversation (idempotent)
   */
  @Post('conversations')
  async startConversation(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: StartConversationDto,
  ) {
    const { conversation, isNew } =
      await this.messagingService.startOrGetConversation(
        user.sub,
        dto.recipient_id,
      );

    if (isNew) {
      this.messagingGateway.emitConversationStarted(
        conversation.participant_one_id,
        conversation.participant_two_id,
        conversation,
      );
    }

    return {
      message: isNew ? 'Conversation started' : 'Conversation retrieved',
      data: conversation,
    };
  }

  /**
   * GET /messaging/conversations/:id
   * Get details of a single conversation
   */
  @Get('conversations/:id')
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const data = await this.messagingService.getConversation(id, user.sub);
    return { message: 'Conversation fetched', data };
  }

  /**
   * GET /messaging/conversations/:id/messages
   * Fetch messages in a conversation (paginated, newest last)
   */
  @Get('conversations/:id/messages')
  async getConversationMessages(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() dto: GetMessagesDto,
  ) {
    const data = await this.messagingService.getConversationMessages(
      id,
      user.sub,
      dto,
    );
    return { message: 'Messages fetched', data };
  }

  /**
   * POST /messaging/conversations/:id/messages
   * Send a direct message within a conversation
   */
  @Post('conversations/:id/messages')
  async sendDirectMessage(
    @Param('id') conversationId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendDirectMessage(
      user.sub,
      conversationId,
      dto,
    );

    // Push real-time to the conversation room
    this.messagingGateway.emitDirectMessage(conversationId, message);

    return { message: 'Message sent', data: message };
  }

  /**
   * PATCH /messaging/conversations/:id/read
   * Mark all messages in a conversation as read
   */
  @Patch('conversations/:id/read')
  async markConversationRead(
    @Param('id') conversationId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    if (conversationId === 'chatroom') return { message: 'Skipped for chatroom' };
    await this.messagingService.markConversationRead(conversationId, user.sub);
    return { message: 'Conversation marked as read' };
  }

  /* ══════════════════════════════════════════════
     MESSAGE DETAIL
  ══════════════════════════════════════════════ */

  /**
   * GET /messaging/messages/:id
   * Full detail for a single message (read time, delivered, read_count)
   */
  @Get('messages/:id')
  async getMessageById(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const data = await this.messagingService.getMessageById(id, user.sub);
    return { message: 'Message details', data };
  }

  /* ══════════════════════════════════════════════
     PRESENCE
  ══════════════════════════════════════════════ */

  /**
   * GET /messaging/presence/:userId
   * Check if a user is online + last seen timestamp
   */
  @Get('presence/:userId')
  getUserPresence(@Param('userId') userId: string) {
    const online = this.messagingGateway.isUserOnline(userId);
    const last_seen = this.messagingGateway.getLastSeen(userId);

    return {
      message: 'Presence info',
      data: {
        user_id: userId,
        online,
        last_seen: online ? null : last_seen?.toISOString() ?? null,
      },
    };
  }
}
