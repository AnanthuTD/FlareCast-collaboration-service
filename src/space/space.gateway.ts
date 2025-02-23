import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { BaseGateway } from '../common/base.gateway';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from 'src/common/events';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/space',
})
export class SpacesGateway extends BaseGateway {
  @SubscribeMessage(SOCKET_EVENTS.JOIN_SPACE)
  async handleJoinSpace(
    @MessageBody() data: { spaceId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { spaceId } = data;

    if (!spaceId) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'spaceId is required' });
      return;
    }

    // Join the room for this spaceId
    socket.join(spaceId);
    console.log(`User ${socket.id} joined space: ${spaceId}`);

    // Optionally, emit a confirmation back to the client
    socket.emit(SOCKET_EVENTS.JOINED_SPACE, { spaceId });
  }

  // Optional: Leave a space if needed
  @SubscribeMessage(SOCKET_EVENTS.LEAVE_SPACE)
  async handleLeaveSpace(
    @MessageBody() data: { spaceId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { spaceId } = data;

    if (!spaceId) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'spaceId is required' });
      return;
    }

    // Leave the room for this spaceId
    socket.leave(spaceId);
    console.log(`User ${socket.id} left space: ${spaceId}`);
  }
}
