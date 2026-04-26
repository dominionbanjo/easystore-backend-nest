import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagingService } from './messaging.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    username?: string;
  };
}

const TYPING_TIMEOUT_MS = 3_000;
const CHATROOM_ROOM = 'chatroom';

/* ────────────────────────────────────────────────
   MESSAGING GATEWAY
   Namespace: /messaging

   Authentication: WS handshake must carry
     auth.token  →  Bearer JWT
──────────────────────────────────────────────── */

@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: '*', credentials: true },
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /** userId → Set of socketIds (user can have multiple tabs) */
  private userSockets = new Map<string, Set<string>>();

  /** socketId → userId  (reverse lookup for disconnect) */
  private socketUser = new Map<string, string>();

  /** socketIds currently in the public chatroom */
  private chatroomSockets = new Set<string>();

  /** socketId → typing timer */
  private typingTimers = new Map<string, NodeJS.Timeout>();

  /** in-memory last_seen: userId → Date */
  private lastSeen = new Map<string, Date>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagingService: MessagingService,
  ) {}

  /* ──────────────────────────────────────────────
     CONNECTION / DISCONNECTION
  ─────────────────────────────────────────────── */

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) throw new WsException('No token provided');

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId = payload.sub;
      client.data.userId = userId;

      // Track presence
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.socketUser.set(client.id, userId);

      // Join personal room so other services can push notifications
      await client.join(`user:${userId}`);

      // Broadcast online status to others
      client.broadcast.emit('user_online', { user_id: userId });

      // Send initial list of online users to the connecting client
      const onlineIds = Array.from(this.userSockets.keys());
      client.emit('online_users_list', { user_ids: onlineIds });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;

    // Clear socket tracking
    this.socketUser.delete(client.id);
    const socks = this.userSockets.get(userId);
    if (socks) {
      socks.delete(client.id);
      if (socks.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Remove from chatroom count
    if (this.chatroomSockets.delete(client.id)) {
      this.server
        .to(CHATROOM_ROOM)
        .emit('chatroom_user_count', { count: this.chatroomSockets.size });
    }

    // Clear any typing timer
    this._clearTyping(client.id);

    // Update last_seen
    const now = new Date();
    this.lastSeen.set(userId, now);

    // Only broadcast offline if no more sockets for user
    if (!this.userSockets.has(userId)) {
      client.broadcast.emit('user_offline', {
        user_id: userId,
        last_seen: now.toISOString(),
      });
    }
  }

  /* ──────────────────────────────────────────────
     ROOM MANAGEMENT
  ─────────────────────────────────────────────── */

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversation_id: string },
  ) {
    if (!data?.conversation_id) return;
    await client.join(`conversation:${data.conversation_id}`);
    return { event: 'joined_conversation', data: { conversation_id: data.conversation_id } };
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversation_id: string },
  ) {
    if (!data?.conversation_id) return;
    await client.leave(`conversation:${data.conversation_id}`);
  }

  @SubscribeMessage('join_chatroom')
  async handleJoinChatroom(@ConnectedSocket() client: AuthenticatedSocket) {
    await client.join(CHATROOM_ROOM);
    this.chatroomSockets.add(client.id);

    // Broadcast updated count to all in chatroom
    this.server
      .to(CHATROOM_ROOM)
      .emit('chatroom_user_count', { count: this.chatroomSockets.size });

    return { event: 'joined_chatroom', data: { count: this.chatroomSockets.size } };
  }

  @SubscribeMessage('leave_chatroom')
  async handleLeaveChatroom(@ConnectedSocket() client: AuthenticatedSocket) {
    await client.leave(CHATROOM_ROOM);
    if (this.chatroomSockets.delete(client.id)) {
      this.server
        .to(CHATROOM_ROOM)
        .emit('chatroom_user_count', { count: this.chatroomSockets.size });
    }
  }

  /* ──────────────────────────────────────────────
     TYPING INDICATORS
  ─────────────────────────────────────────────── */

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversation_id: string } | { chatroom: true },
  ) {
    const userId = client.data.userId;
    const room = 'chatroom' in data ? CHATROOM_ROOM : `conversation:${data.conversation_id}`;
    const contextId = 'chatroom' in data ? 'chatroom' : data.conversation_id;

    // Broadcast to all others in the room
    client.to(room).emit('user_typing', {
      user_id: userId,
      conversation_id: contextId,
    });

    // Auto-stop after timeout
    this._resetTypingTimer(client.id, userId, room, contextId);
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversation_id: string } | { chatroom: true },
  ) {
    const userId = client.data.userId;
    const room = 'chatroom' in data ? CHATROOM_ROOM : `conversation:${data.conversation_id}`;
    const contextId = 'chatroom' in data ? 'chatroom' : data.conversation_id;

    this._clearTyping(client.id);
    client.to(room).emit('user_stopped_typing', {
      user_id: userId,
      conversation_id: contextId,
    });
  }

  /* ──────────────────────────────────────────────
     DELIVERY ACKNOWLEDGEMENT
  ─────────────────────────────────────────────── */

  @SubscribeMessage('mark_delivered')
  async handleMarkDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { message_id: string },
  ) {
    if (!data?.message_id) return;

    await this.messagingService.markMessageDelivered(data.message_id);

    // Notify sender
    // (We'd need to look up sender_id from DB, but to avoid extra query,
    //  we push to the conversation room — the sender is already there)
    client.broadcast.emit('message_delivered', {
      message_id: data.message_id,
    });
  }

  @SubscribeMessage('read_conversation')
  async handleReadConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversation_id: string },
  ) {
    if (!data?.conversation_id) return;
    
    const userId = client.data.userId;
    await this.messagingService.markConversationRead(data.conversation_id, userId);

    // Notify other participant that we've read their messages
    // The service handles DB update, we just need to broadcast the 'conversation_read' event
    client.to(`conversation:${data.conversation_id}`).emit('conversation_read', {
      conversation_id: data.conversation_id,
      reader_id: userId,
      read_at: new Date().toISOString(),
    });
  }

  /* ──────────────────────────────────────────────
     PUBLIC EMIT HELPERS (called by service via gateway)
  ─────────────────────────────────────────────── */

  /** Emit a new DM to the conversation room */
  emitDirectMessage(conversationId: string, message: object) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('new_direct_message', message);
  }

  /** Broadcast a chatroom message to all joined */
  emitChatroomMessage(message: object) {
    this.server.to(CHATROOM_ROOM).emit('new_chatroom_message', message);
  }

  /** Push a new conversation to both participants' personal rooms */
  emitConversationStarted(
    participantOneId: string,
    participantTwoId: string,
    conversation: object,
  ) {
    this.server
      .to(`user:${participantOneId}`)
      .to(`user:${participantTwoId}`)
      .emit('conversation_started', conversation);
  }

  /** Push a read receipt to the sender's personal room */
  emitMessageRead(senderId: string, messageId: string, readAt: Date) {
    this.server.to(`user:${senderId}`).emit('message_read', {
      message_id: messageId,
      read_at: readAt.toISOString(),
    });
  }

  /* ──────────────────────────────────────────────
     PRESENCE HELPERS
  ─────────────────────────────────────────────── */

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getLastSeen(userId: string): Date | null {
    return this.lastSeen.get(userId) ?? null;
  }

  getChatroomCount(): number {
    return this.chatroomSockets.size;
  }

  /* ──────────────────────────────────────────────
     PRIVATE HELPERS
  ─────────────────────────────────────────────── */

  private _resetTypingTimer(
    socketId: string,
    userId: string,
    room: string,
    contextId: string,
  ) {
    // Clear existing
    this._clearTyping(socketId);

    const timer = setTimeout(() => {
      this.server.to(room).emit('user_stopped_typing', {
        user_id: userId,
        conversation_id: contextId,
      });
      this.typingTimers.delete(socketId);
    }, TYPING_TIMEOUT_MS);

    this.typingTimers.set(socketId, timer);
  }

  private _clearTyping(socketId: string) {
    const existing = this.typingTimers.get(socketId);
    if (existing) {
      clearTimeout(existing);
      this.typingTimers.delete(socketId);
    }
  }
}
