import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';

import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,

    @InjectRepository(MessageRead)
    private readonly messageReadRepo: Repository<MessageRead>,
  ) {}

  /* ──────────────────────────────────────────────
     HELPERS
  ─────────────────────────────────────────────── */

  /** Normalise participant order so (A,B) === (B,A) */
  private normalisePair(
    a: string,
    b: string,
  ): { one: string; two: string } {
    return a < b ? { one: a, two: b } : { one: b, two: a };
  }

  private buildPagination(
    total: number,
    page: number,
    limit: number,
  ) {
    const pages = Math.ceil(total / limit);
    return {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    };
  }

  private sanitizeParticipant(user: any) {
    if (!user) return null;
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      avatar: user.avatar,
      account_type: user.account_type,
      store_name: user.store?.store_name || null,
      created_at: user.created_at,
    };
  }

  /* ──────────────────────────────────────────────
     CONVERSATIONS
  ─────────────────────────────────────────────── */

  /** Start or return existing 1-to-1 conversation (idempotent) */
  async startOrGetConversation(
    requesterId: string,
    recipientId: string,
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    if (requesterId === recipientId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    const { one, two } = this.normalisePair(requesterId, recipientId);

    let conversation = await this.conversationRepo.findOne({
      where: { participant_one_id: one, participant_two_id: two },
      relations: ['participant_one', 'participant_two'],
    });

    if (conversation) {
      return { conversation, isNew: false };
    }

    conversation = this.conversationRepo.create({
      participant_one_id: one,
      participant_two_id: two,
    });

    conversation = await this.conversationRepo.save(conversation);

    // Re-fetch with relations
    conversation = await this.conversationRepo.findOne({
      where: { id: conversation.id },
      relations: ['participant_one', 'participant_two'],
    });

    return { conversation: conversation!, isNew: true };
  }

  /** List all conversations for a user, ordered by latest message */
  async getUserConversations(userId: string) {
    const conversations = await this.conversationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.participant_one', 'p1')
      .leftJoinAndSelect('p1.store', 's1')
      .leftJoinAndSelect('c.participant_two', 'p2')
      .leftJoinAndSelect('p2.store', 's2')
      .where(
        'c.participant_one_id = :uid OR c.participant_two_id = :uid',
        { uid: userId },
      )
      .orderBy('c.last_message_at', 'DESC', 'NULLS LAST')
      .addOrderBy('c.created_at', 'DESC')
      .getMany();

    // Attach correct unread count from current user's perspective
    return conversations.map((conv) => {
      const isOne = conv.participant_one_id === userId;
      const unread_count = isOne
        ? conv.participant_one_unread
        : conv.participant_two_unread;

      const other_participant = isOne
        ? conv.participant_two
        : conv.participant_one;

      return {
        id: conv.id,
        other_participant: this.sanitizeParticipant(other_participant),
        last_message_preview: conv.last_message_preview,
        last_message_at: conv.last_message_at,
        unread_count,
        created_at: conv.created_at,
      };
    });
  }

  /** Get a single conversation (validates user is a participant) */
  async getConversation(conversationId: string, userId: string) {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId },
      relations: ['participant_one', 'participant_one.store', 'participant_two', 'participant_two.store'],
    });

    if (!conv) throw new NotFoundException('Conversation not found');

    if (
      conv.participant_one_id !== userId &&
      conv.participant_two_id !== userId
    ) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const isOne = conv.participant_one_id === userId;
    return {
      id: conv.id,
      other_participant: this.sanitizeParticipant(isOne ? conv.participant_two : conv.participant_one),
      unread_count: isOne
        ? conv.participant_one_unread
        : conv.participant_two_unread,
      last_message_preview: conv.last_message_preview,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
    };
  }

  /* ──────────────────────────────────────────────
     DIRECT MESSAGES
  ─────────────────────────────────────────────── */

  async sendDirectMessage(
    senderId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<Message> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conv) throw new NotFoundException('Conversation not found');

    if (
      conv.participant_one_id !== senderId &&
      conv.participant_two_id !== senderId
    ) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const recipientId =
      conv.participant_one_id === senderId
        ? conv.participant_two_id
        : conv.participant_one_id;

    // Persist message
    let message = this.messageRepo.create({
      sender_id: senderId,
      recipient_id: recipientId,
      conversation_id: conversationId,
      is_public: false,
      content: dto.content,
      product_id: dto.product_id ?? null,
      product_name: dto.product_name ?? null,
      product_image: dto.product_image ?? null,
      product_slug: dto.product_slug ?? null,
    });

    message = await this.messageRepo.save(message);

    // Update conversation metadata
    const isOne = conv.participant_one_id === senderId;
    await this.conversationRepo.update(conversationId, {
      last_message_preview:
        dto.content.length > 80
          ? dto.content.slice(0, 80) + '…'
          : dto.content,
      last_message_at: message.created_at,
      participant_one_unread: isOne
        ? 0 // sender doesn't have unread
        : conv.participant_one_unread + 1,
      participant_two_unread: !isOne
        ? 0
        : conv.participant_two_unread + 1,
    });

    // Reload with sender relation for WS emit
    const finalMessage = await this.messageRepo.findOne({
      where: { id: message.id },
      relations: ['sender', 'sender.store'],
    });

    if (finalMessage) {
      finalMessage.sender = this.sanitizeParticipant(finalMessage.sender) as any;
      if (dto.local_id) {
        (finalMessage as any).local_id = dto.local_id;
      }
    }

    return finalMessage as Message;
  }

  /** Paginated messages within a conversation (newest first) */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    dto: GetMessagesDto,
  ) {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conv) throw new NotFoundException('Conversation not found');

    if (
      conv.participant_one_id !== userId &&
      conv.participant_two_id !== userId
    ) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 30;

    const [messages, total] = await this.messageRepo.findAndCount({
      where: { conversation_id: conversationId },
      relations: ['sender', 'sender.store'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: messages.reverse().map((m) => ({
        ...m,
        sender: this.sanitizeParticipant(m.sender),
      })),
      pagination: this.buildPagination(total, page, limit),
    };
  }

  /** Mark all unread messages in a conversation as read */
  async markConversationRead(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conv) throw new NotFoundException('Conversation not found');

    if (
      conv.participant_one_id !== userId &&
      conv.participant_two_id !== userId
    ) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    // Mark all undelivered-to-this-user messages as read
    await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ read_at: () => 'NOW()' })
      .where(
        'conversation_id = :cid AND recipient_id = :uid AND read_at IS NULL',
        { cid: conversationId, uid: userId },
      )
      .execute();

    // Reset unread counter for this user
    const isOne = conv.participant_one_id === userId;
    await this.conversationRepo.update(conversationId, {
      ...(isOne
        ? { participant_one_unread: 0 }
        : { participant_two_unread: 0 }),
    });
  }

  /** Mark a single DM as delivered */
  async markMessageDelivered(messageId: string): Promise<void> {
    await this.messageRepo.update(
      { id: messageId, delivered_at: IsNull() },
      { delivered_at: () => 'NOW()' },
    );
  }

  /* ──────────────────────────────────────────────
     PUBLIC CHATROOM
  ─────────────────────────────────────────────── */

  async sendChatroomMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<Message> {
    let message = this.messageRepo.create({
      sender_id: senderId,
      recipient_id: null,
      conversation_id: null,
      is_public: true,
      content: dto.content,
      product_id: dto.product_id ?? null,
      product_name: dto.product_name ?? null,
      product_image: dto.product_image ?? null,
      product_slug: dto.product_slug ?? null,
    });

    message = await this.messageRepo.save(message);

    const finalMessage = await this.messageRepo.findOne({
      where: { id: message.id },
      relations: ['sender', 'sender.store'],
    });

    if (finalMessage) {
      finalMessage.sender = this.sanitizeParticipant(finalMessage.sender) as any;
      if (dto.local_id) {
        (finalMessage as any).local_id = dto.local_id;
      }
    }

    return finalMessage as Message;
  }

  /** Paginated chatroom messages (newest last — append mode) */
  async getChatroomMessages(dto: GetMessagesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 30;

    const [messages, total] = await this.messageRepo.findAndCount({
      where: { is_public: true },
      relations: ['sender', 'sender.store', 'reads'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Attach read_count to each message and sanitize sender
    const items = messages.reverse().map((m) => ({
      ...m,
      sender: this.sanitizeParticipant(m.sender),
      read_count: m.reads?.length ?? 0,
    }));

    return {
      data: items,
      pagination: this.buildPagination(total, page, limit),
    };
  }

  /** Record that a user read a chatroom message (upsert-safe) */
  async markChatroomMessageRead(
    messageId: string,
    userId: string,
  ): Promise<void> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId, is_public: true },
    });

    if (!message) throw new NotFoundException('Chatroom message not found');

    // Upsert — ignore if already exists
    await this.messageReadRepo
      .createQueryBuilder()
      .insert()
      .into(MessageRead)
      .values({ message_id: messageId, user_id: userId })
      .onConflict('("message_id","user_id") DO NOTHING')
      .execute();
  }

  /* ──────────────────────────────────────────────
     MESSAGE DETAIL
  ─────────────────────────────────────────────── */

  /** Get full details of a single message */
  async getMessageById(messageId: string, userId: string): Promise<object> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['sender', 'recipient', 'reads', 'reads.user'],
    });

    if (!message) throw new NotFoundException('Message not found');

    // Only sender, recipient, or chatroom participant can view
    if (!message.is_public) {
      if (message.sender_id !== userId && message.recipient_id !== userId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      id: message.id,
      sender: this.sanitizeParticipant(message.sender),
      recipient: this.sanitizeParticipant(message.recipient),
      conversation_id: message.conversation_id,
      is_public: message.is_public,
      content: message.content,
      product_id: message.product_id,
      product_name: message.product_name,
      product_image: message.product_image,
      product_slug: message.product_slug,
      delivered_at: message.delivered_at,
      read_at: message.read_at,
      // For chatroom: full read list with timestamps
      reads: message.is_public
        ? message.reads.map((r) => ({
            user_id: r.user_id,
            user: r.user,
            read_at: r.read_at,
          }))
        : undefined,
      read_count: message.is_public ? message.reads?.length ?? 0 : undefined,
      created_at: message.created_at,
      updated_at: message.updated_at,
    };
  }
}
