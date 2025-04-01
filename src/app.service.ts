import { ForbiddenException, Injectable } from '@nestjs/common';
import { Member } from '@prisma/client';
import { FolderService } from './folder/folder.service';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(
    private readonly folderService: FolderService,
    private readonly databaseService: DatabaseService,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

  async getPermissionToShareFile({
    userId,
    source,
    destination,
  }: {
    userId: string;
    source: { workspaceId?: string; spaceId?: string; folderId?: string };
    destination: { spaceId?: string; folderId?: string };
  }) {
    const requiredRoles: Member['role'][] = ['ADMIN', 'EDITOR'];

    // Check source permissions (folder or workspace)
    const sourceWorkspaceId = await this.verifySourcePermission(
      userId,
      source,
      requiredRoles,
    );

    // Check destination permissions and ensure no cross-workspace sharing
    const result = await this.verifyDestinationPermission(
      userId,
      sourceWorkspaceId,
      destination,
      requiredRoles,
    );

    return { permission: 'granted', ...result };
  }

  /**
   * Ensures the user has the correct role for the source (folder or workspace).
   * Returns the workspace ID associated with the source.
   */
  private async verifySourcePermission(
    userId: string,
    source: { workspaceId?: string; spaceId?: string; folderId?: string },
    requiredRoles: Member['role'][],
  ): Promise<string> {
    if (source.folderId) {
      const folder = await this.folderService.checkFolderPermission({
        userId,
        requiredRoles,
        folderId: source.folderId,
      });
      return folder.workspaceId;
    }

    const workspace = await this.folderService.checkWorkspacePermission({
      userId,
      requiredRoles,
      spaceId: source.spaceId,
      workspaceId: source.workspaceId,
    });

    return workspace.workspaceId;
  }

  /**
   * Ensures the user has the correct role for the destination and that sharing
   * is within the same workspace.
   */
  private async verifyDestinationPermission(
    userId: string,
    sourceWorkspaceId: string,
    destination: { spaceId?: string; folderId?: string },
    requiredRoles: Member['role'][],
  ) {
    if (destination.folderId) {
      const folder = await this.folderService.checkFolderPermission({
        userId,
        requiredRoles,
        folderId: destination.folderId,
      });

      if (folder.workspaceId !== sourceWorkspaceId) {
        throw new ForbiddenException(
          'Cannot share files across different workspaces.',
        );
      }

      return {
        folderId: folder.id,
        spaceId: folder.spaceId,
        workspaceId: folder.workspaceId,
      };
    } else if (destination.spaceId) {
      const space = await this.folderService.checkWorkspacePermission({
        userId,
        requiredRoles,
        spaceId: destination.spaceId,
        workspaceId: sourceWorkspaceId,
      });

      if (space.workspaceId !== sourceWorkspaceId) {
        throw new ForbiddenException(
          'Cannot share files across different workspaces.',
        );
      }

      return {
        folderId: null,
        spaceId: destination.spaceId,
        workspaceId: sourceWorkspaceId,
      };
    } else {
      throw new ForbiddenException(
        'Invalid destination: Either folderId or spaceId must be provided.',
      );
    }
  }

  async isMember(
    spaceId: string,
    userId: string,
  ): Promise<{ isMember: boolean }> {
    const member = await this.databaseService.member.findFirst({
      where: {
        userId: userId,
        spaceIds: {
          has: spaceId,
        },
      },
    });

    console.log(member);

    return { isMember: !!member };
  }
}
