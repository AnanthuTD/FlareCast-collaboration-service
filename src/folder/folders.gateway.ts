import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { BaseGateway } from '../common/base.gateway';
import { SOCKET_EVENTS } from 'src/common/events';
import { Socket } from 'socket.io';
import { Folder } from '@prisma/client';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/folder',
  /*  cors: {
    cors: true,
    origin: ['*'],
    credentials: true,
  }, */
})
export class FoldersGateway extends BaseGateway {
  private readonly logger = new Logger(FoldersGateway.name);

  createRoomId({
    folderId,
    workspaceId,
    spaceId,
  }: {
    folderId: string;
    workspaceId: string;
    spaceId: string;
  }) {
    if (folderId) {
      return `folder-${folderId}`;
    }
    if (spaceId) {
      return `space-${spaceId}`;
    }
    return `workspace-${workspaceId}`;
  }

  @SubscribeMessage(SOCKET_EVENTS.FOLDER_UPDATES)
  handleFolderUpdates(
    @ConnectedSocket() socket: Socket,
    data: { folderId: string; spaceId: string; workspaceId: string },
  ) {
    this.logger.log(`Subscribed to folder updates: ${JSON.stringify(data)}`);

    const roomId = this.createRoomId({
      folderId: data.folderId,
      workspaceId: data.workspaceId,
      spaceId: data.spaceId,
    });

    socket.join(roomId);
  }

  emitToFolder(event: string, data: Partial<Folder>) {
    const roomId = this.createRoomId({
      folderId: data.id,
      workspaceId: data.workspaceId,
      spaceId: data.spaceId,
    });

    // Emit to the room named after the userId
    this.server.to(roomId).emit(event, data);
  }
}
