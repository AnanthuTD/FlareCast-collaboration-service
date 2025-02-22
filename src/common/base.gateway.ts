import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit, UseGuards } from '@nestjs/common';
import { WsAuthGuard } from './ws-auth.guard';
import { AuthWsMiddleware } from './ws-auth.middleware';
// import { createClient } from 'redis';
// import { createShardedAdapter } from '@socket.io/redis-adapter';

@WebSocketGateway({
  cors: {
    cors: true,
    origin: ['*'],
  },
})
// @UseGuards(WsAuthGuard)
export class BaseGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  protected server: Server;

  private activeUsers = new Map<string, string>();

  /* async afterInit(@ConnectedSocket() socket: Socket) {
    console.log('after init');

    socket.use((event, next) => {
      console.log('after init');
      console.log(event);
      next();
    });
  } */

  async handleConnection(socket: Socket) {
    console.log(`Client connected: ${socket.id}`, socket.handshake.auth?.user);
    const userId = socket.handshake.auth?.user?.id;
    if (userId) {
      this.activeUsers.set(socket.id, userId);
    }
  }

  async handleDisconnect(socket: Socket) {
    this.activeUsers.delete(socket.id);
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketId = [...this.activeUsers.entries()].find(
      ([, id]) => id === userId,
    )?.[0];
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }
}
