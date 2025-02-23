import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthWsMiddleware } from './ws-auth.middleware';

@WebSocketGateway({
  namespace: 'collaboration', // Matches /collaboration/socket.io/
  /* cors: {
    origin: ['http://localhost:3000', 'https://flarecast.ananthutd.live'], // Explicit origins
    credentials: true, // Allow cookies
  }, */
})
export class BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  protected server: Server;

  async afterInit(@ConnectedSocket() socket: Socket) {
    socket.use(AuthWsMiddleware());
  }

  async handleConnection(socket: Socket) {
    console.log(`Client connected: ${socket.id}`, socket.handshake.auth?.user);
    const userId = socket.data.user.id;
    if (userId) {
      // Join a room named after the userId
      socket.join(userId);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.user.id;
    if (userId) {
      // Leave the room (optional, since Socket.IO cleans up on disconnect)
      socket.leave(userId);
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    // Emit to the room named after the userId
    this.server.to(userId).emit(event, data);
  }
}
