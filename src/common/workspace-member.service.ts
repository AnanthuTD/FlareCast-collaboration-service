import { Injectable } from '@nestjs/common';
import { Member, Prisma } from '@prisma/client';
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

  async isUserMemberOfSpace({
    spaceId,
    userId,
    workspaceId,
  }: {
    userId: string;
    workspaceId?: string;
    spaceId?: string;
  }): Promise<boolean> {
    if (workspaceId && spaceId) {
      const member = await this.databaseService.member.findFirst({
        where: {
          workspaceId,
          userId,
          spaceIds: { has: spaceId },
        },
      });
      return !!member;
    } else if (workspaceId) {
      const member = await this.databaseService.member.findFirst({
        where: {
          workspaceId,
          userId,
        },
      });
      return !!member;
    }

    const space = await this.databaseService.space.findFirst({
      where: {
        id: spaceId,
        members: { some: { userId } },
      },
    });

    return !!space;
  }

  async userHasInviteAuthority({
    workspaceId,
    userId,
  }: {
    workspaceId: string;
    userId: string;
  }) {
    const workSpace = await this.databaseService.workSpace.findFirst({
      where: { id: workspaceId, members: { some: { userId, role: 'ADMIN' } } },
    });

    return workSpace;
  }

  async isAdminOfWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    return !!(await this.databaseService.workSpace.findFirst({
      where: { id: workspaceId, members: { some: { userId, role: 'ADMIN' } } },
    }));
  }

  /**
   * Retrieves the user's role in a workspace or space.
   */
  async getUserRole({
    workspaceId,
    userId,
    spaceId,
  }: {
    workspaceId: string;
    userId: string;
    spaceId?: string;
  }): Promise<{ role: Member['role']; workspaceId: string } | null> {
    const query: Prisma.MemberWhereInput = {
      userId,
    };
    if (workspaceId && spaceId) {
      query.workspaceId = workspaceId;
      query.spaceIds = { has: spaceId };
    } else if (workspaceId) {
      query.workspaceId = workspaceId;
    } else if (spaceId) {
      query.spaceIds = { has: spaceId };
    } else {
      return null;
    }

    const member = await this.databaseService.member.findFirst({
      where: query,
      select: { role: true, workspaceId: true },
    });

    return member || null;
  }
}
