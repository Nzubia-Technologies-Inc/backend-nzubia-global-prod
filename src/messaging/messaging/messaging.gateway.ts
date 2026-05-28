import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport'; // Guards on WS are tricky, usually need custom adapter

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('MessagingGateway');

  constructor(
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
  ) { }

  handleConnection(client: Socket, ...args: any[]) {
    // Auth token verification should happen here usually via handshake query/headers
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { roomId: string; message: string; senderId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<string> {
    this.logger.log(`Received message in room ${data.roomId}: ${data.message}`);

    // Save to DB
    try {
      await this.messageRepo.save({
        room_id: data.roomId,
        content: data.message,
        sender_id: data.senderId,
      });
    } catch (e) {
      this.logger.error(`Failed to save message: ${e.message}`);
    }

    // Broadcast to room
    this.server.to(data.roomId).emit('newMessage', data);
    return 'Message sent';
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    this.logger.log(`Client ${client.id} joined room ${roomId}`);
    return `Joined ${roomId}`;
  }
}
