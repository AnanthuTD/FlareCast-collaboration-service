import { WebSocketGateway, SubscribeMessage } from '@nestjs/websockets';
import { BaseGateway } from '../common/base.gateway';
import { SOCKET_EVENTS } from 'src/common/events';

@WebSocketGateway({ namespace: 'workspaces' })
export class WorkspacesGateway extends BaseGateway {
  @SubscribeMessage(SOCKET_EVENTS.WORKSPACE_UPDATES)
  handleWorkspaceUpdates(
    client: any,
    data: { userId: string; workspace: any },
  ) {
    this.emitToUser(
      data.userId,
      SOCKET_EVENTS.WORKSPACE_UPDATES,
      data.workspace,
    );
  }
}
