import { WebSocketGateway, SubscribeMessage } from '@nestjs/websockets';
import { BaseGateway } from '../common/base.gateway';
import { SOCKET_EVENTS } from 'src/common/events';

@WebSocketGateway()
export class FoldersGateway extends BaseGateway {
  @SubscribeMessage(SOCKET_EVENTS.FOLDER_CREATED)
  handleCreateFolder(client: any, data: { userId: string; folder: any }) {
    this.emitToUser(data.userId, 'folder:created', data.folder);
  }
}
