import { WebSocketGateway, SubscribeMessage } from '@nestjs/websockets';
import { BaseGateway } from '../common/base.gateway';
import { SOCKET_EVENTS } from 'src/common/events';

@WebSocketGateway()
export class WorkspacesGateway extends BaseGateway {
  @SubscribeMessage(SOCKET_EVENTS.WORKSPACE_CREATED)
  handleCreateWorkspace(client: any, data: { userId: string; workspace: any }) {
    this.emitToUser(data.userId, 'workspace:created', data.workspace);
  }
}
