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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';

import { ApiStandardErrorResponses } from '../../../common/decorators/api-standard-errors.decorator';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';

@ApiTags('Messaging')
@ApiBearerAuth('JWT-auth')
@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Get('chatroom')
  @ApiOperation({ summary: 'Get chatroom messages', description: 'Fetches paginated public chatroom messages (newest last).' })
  @ApiOkResponse({ description: 'Chatroom messages returned' })
  @ApiStandardErrorResponses()
  async getChatroomMessages(@Query() dto: GetMessagesDto) {
    const result = await this.messagingService.getChatroomMessages(dto);
    return { message: 'Chatroom messages fetched', data: result };
  }

  @Post('chatroom')
  @ApiOperation({ summary: 'Send chatroom message', description: 'Sends a message to the public chatroom.' })
  @ApiCreatedResponse({ description: 'Message sent to chatroom' })
  @ApiStandardErrorResponses()
  async sendChatroomMessage(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendChatroomMessage(
      user.sub,
      dto,
    );

    this.messagingGateway.emitChatroomMessage(message);

    return { message: 'Message sent', data: message };
  }

  @Get('chatroom/status')
  @ApiOperation({ summary: 'Get chatroom status', description: 'Returns the number of users currently online in the chatroom.' })
  @ApiOkResponse({ description: 'Chatroom status returned' })
  @ApiStandardErrorResponses()
  getChatroomStatus() {
    return {
      message: 'Chatroom status',
      data: { online_count: this.messagingGateway.getChatroomCount() },
    };
  }

  @Post('chatroom/:messageId/read')
  @ApiOperation({ summary: 'Mark chatroom message as read', description: 'Marks a specific chatroom message as read by the current user.' })
  @ApiParam({ name: 'messageId', description: 'Message ID', type: String })
  @ApiOkResponse({ description: 'Message marked as read' })
  @ApiStandardErrorResponses()
  async markChatroomMessageRead(
    @Param('messageId') messageId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    await this.messagingService.markChatroomMessageRead(messageId, user.sub);
    return { message: 'Message marked as read' };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations', description: 'Returns all conversations for the currently authenticated user.' })
  @ApiOkResponse({ description: 'Conversations returned' })
  @ApiStandardErrorResponses()
  async getUserConversations(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const data = await this.messagingService.getUserConversations(user.sub);
    return { message: 'Conversations fetched', data };
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start a conversation', description: 'Starts or retrieves an existing 1-to-1 conversation with another user.' })
  @ApiCreatedResponse({ description: 'Conversation started or retrieved' })
  @ApiStandardErrorResponses()
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

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details', description: 'Returns details of a single conversation by ID.' })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiOkResponse({ description: 'Conversation details returned' })
  @ApiStandardErrorResponses()
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const data = await this.messagingService.getConversation(id, user.sub);
    return { message: 'Conversation fetched', data };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get conversation messages', description: 'Fetches paginated messages for a conversation (newest last).' })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiOkResponse({ description: 'Conversation messages returned' })
  @ApiStandardErrorResponses()
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

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send direct message', description: 'Sends a direct message within a conversation.' })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiCreatedResponse({ description: 'Message sent' })
  @ApiStandardErrorResponses()
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

    this.messagingGateway.emitDirectMessage(conversationId, message);

    return { message: 'Message sent', data: message };
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read', description: 'Marks all messages in a conversation as read by the current user.' })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiOkResponse({ description: 'Conversation marked as read' })
  @ApiStandardErrorResponses()
  async markConversationRead(
    @Param('id') conversationId: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    if (conversationId === 'chatroom') return { message: 'Skipped for chatroom' };
    await this.messagingService.markConversationRead(conversationId, user.sub);
    return { message: 'Conversation marked as read' };
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get message details', description: 'Returns full details for a single message including read time and delivery status.' })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiOkResponse({ description: 'Message details returned' })
  @ApiStandardErrorResponses()
  async getMessageById(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const data = await this.messagingService.getMessageById(id, user.sub);
    return { message: 'Message details', data };
  }

  @Get('presence/:userId')
  @ApiOperation({ summary: 'Get user presence', description: 'Checks if a user is currently online and returns their last seen timestamp.' })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiOkResponse({ description: 'Presence info returned' })
  @ApiStandardErrorResponses()
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
