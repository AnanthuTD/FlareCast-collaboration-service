import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class WorkspaceMemberService {
  constructor(private readonly databaseService: DatabaseService) {}

  async isUserMemberOfWorkspace({
    workspaceId,
    userId,
  }: {
    workspaceId: string;
    userId: string;
  }): Promise<boolean> {
    return !!(await this.databaseService.workSpace.findFirst({
      where: {
        OR: [
          { id: workspaceId, userId },
          { id: workspaceId, members: { some: { userId } } },
        ],
      },
    }));
  }

  async userHasInviteAuthority({
    workspaceId,
    userId,
  }: {
    workspaceId: string;
    userId: string;
  }) {
    const workSpace = await this.databaseService.workSpace.findFirst({
      where: { id: workspaceId, userId },
    });

    return workSpace;
  }
}
