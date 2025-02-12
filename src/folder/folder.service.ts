import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Member } from '@prisma/client';
import { WorkspaceMemberService } from 'src/common/workspace-member.service';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {}

  /**
   * Validates if a user has a required role within a space/workspace.
   */
  private async checkFolderPermission({
    workspaceId,
    userId,
    spaceId,
    requiredRoles,
  }: {
    workspaceId: string;
    userId: string;
    spaceId?: string;
    requiredRoles: Member['role'][];
  }) {
    const userRole = await this.workspaceMemberService.getUserRole({
      workspaceId,
      userId,
      spaceId,
    });

    if (!userRole) {
      throw new NotFoundException(
        'User is not a member of the workspace or space.',
      );
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `You do not have permission to perform this action.`,
      );
    }
  }

  /**
   * Ensures the user is a member of either the workspace or space.
   */
  private async validateMembership(
    workspaceId: string,
    userId: string,
    spaceId?: string,
  ) {
    const isMember = await this.workspaceMemberService.isUserMemberOfSpace({
      workspaceId,
      userId,
      spaceId,
    });

    if (!isMember) {
      throw new NotFoundException(
        'User is not a member of the workspace or space.',
      );
    }
  }

  /**
   * Fetch folders based on parent folder and space/workspace membership.
   */
  async findFolders(
    workspaceId: string,
    userId: string,
    folderId?: string,
    spaceId?: string,
  ) {
    console.log(workspaceId, folderId, userId, spaceId);

    await this.validateMembership(workspaceId, userId, spaceId);

    return this.databaseService.folder.findMany({
      where: {
        workspaceId,
        parentFolderId: folderId || null,
        spaceId: spaceId || null,
      },
      select: { id: true, name: true, createdAt: true, workspaceId: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a new folder.
   */
  async createFolder(
    workspaceId: string,
    userId: string,
    folderId?: string,
    spaceId?: string,
  ) {
    await this.checkFolderPermission({
      workspaceId,
      userId,
      spaceId,
      requiredRoles: ['ADMIN', 'EDITOR'],
    });

    const folder = await this.databaseService.folder.create({
      data: {
        workspaceId,
        name: 'Untitled Folder',
        parentFolderId: folderId || null,
        spaceId: spaceId || null,
      },
    });

    this.logger.log(folder);
    return folder;
  }

  /**
   * Deletes a folder.
   */
  async deleteFolder(
    workspaceId: string,
    userId: string,
    folderId: string,
    spaceId?: string,
  ) {
    await this.checkFolderPermission({
      workspaceId,
      userId,
      spaceId,
      requiredRoles: ['ADMIN'],
    });

    await this.databaseService.folder.deleteMany({
      where: { parentFolderId: folderId },
    });

    return this.databaseService.folder.delete({ where: { id: folderId } });
  }

  /**
   * Renames a folder.
   */
  async renameFolder(
    workspaceId: string,
    userId: string,
    folderId: string,
    newName: string,
  ) {
    await this.checkFolderPermission({
      workspaceId,
      userId,
      spaceId: undefined,
      requiredRoles: ['ADMIN', 'EDITOR'],
    });

    this.logger.log(`Renaming folder to: ${newName}`);

    return this.databaseService.folder.update({
      where: { id: folderId },
      data: { name: newName },
    });
  }

  /**
   * Retrieves parent folders recursively.
   */
  async getParentFolders(
    workspaceId: string,
    userId: string,
    folderId: string,
  ) {
    await this.validateMembership(workspaceId, userId);

    const parentFolders = [];
    let currentFolder = await this.databaseService.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        workspaceId: true,
        parentFolderId: true,
      },
    });

    while (currentFolder) {
      parentFolders.unshift(currentFolder);
      if (!currentFolder.parentFolderId) break;
      currentFolder = await this.databaseService.folder.findUnique({
        where: { id: currentFolder.parentFolderId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          workspaceId: true,
          parentFolderId: true,
        },
      });
    }

    return { parentFolders };
  }
}
