import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Member } from '@prisma/client';
import { WorkspaceMemberService } from 'src/common/workspace-member.service';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { FoldersGateway } from './folders.gateway';
import { SOCKET_EVENTS } from 'src/common/events';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
    private readonly workspaceMemberService: WorkspaceMemberService,
    private readonly folderGateway: FoldersGateway,
  ) {}

  /**
   * Validates if a user has a required role within a space/workspace.
   */
  async checkFolderPermission({
    userId,
    requiredRoles,
    folderId,
  }: {
    userId: string;
    requiredRoles: Member['role'][];
    folderId: string;
  }) {
    const folder = await this.databaseService.folder.findUnique({
      where: { id: folderId },
      select: { id: true, spaceId: true, workspaceId: true },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found.');
    }

    // if the folder is inside a space then check if the user has permission.
    // if not space then it is a my library, so user has full rights.

    return folder;
  }

  async checkWorkspacePermission({
    userId,
    requiredRoles,
    workspaceId,
    spaceId,
  }: {
    userId: string;
    requiredRoles: Member['role'][];
    workspaceId?: string;
    spaceId?: string;
  }) {
    if (!workspaceId && !spaceId) {
      throw new BadRequestException('Required workspaceId or spaceId');
    }

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

    if (!requiredRoles.includes(userRole.role)) {
      throw new ForbiddenException(
        `You do not have permission to perform this action.`,
      );
    }

    return userRole;
  }

  /**
   * Ensures the user is a member of either the workspace or space.
   */
  async validateMembership({
    workspaceId,
    userId,
    spaceId,
  }: {
    workspaceId?: string;
    userId: string;
    spaceId?: string;
  }) {
    console.log(workspaceId, userId);
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
  async findFolders({
    workspaceId,
    userId,
    folderId,
    spaceId,
  }: {
    workspaceId: string;
    userId: string;
    folderId?: string;
    spaceId?: string;
  }) {
    console.log(workspaceId, folderId, userId, spaceId);

    await this.validateMembership({ workspaceId, userId, spaceId });

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
  async createFolder({
    workspaceId,
    userId,
    folderId,
    spaceId,
  }: {
    workspaceId: string;
    userId: string;
    folderId?: string;
    spaceId?: string;
  }) {
    const requiredRoles: Member['role'][] = ['ADMIN', 'EDITOR'];

    // Check if the user has access to the folder
    if (folderId) {
      await this.checkFolderPermission({
        userId,
        requiredRoles,
        folderId,
      });
    } else if (spaceId) {
      // check if the user has permission to the space
      await this.checkWorkspacePermission({
        userId,
        requiredRoles,
        spaceId,
        workspaceId,
      });
    }

    // user has sufficient permissions

    const folder = await this.databaseService.folder.create({
      data: {
        workspaceId,
        name: 'Untitled Folder',
        parentFolderId: folderId || null,
        spaceId: spaceId || null,
      },
    });

    this.folderGateway.emitToFolder(SOCKET_EVENTS.FOLDER_UPDATES, folder);

    return folder;
  }

  /**
   * Deletes a folder.
   */
  async deleteFolder({
    userId,
    folderId,
  }: {
    userId: string;
    folderId: string;
  }) {
    const folder = await this.checkFolderPermission({
      userId,
      requiredRoles: ['ADMIN'],
      folderId,
    });

    await this.databaseService.folder.deleteMany({
      where: { parentFolderId: folderId },
    });

    this.folderGateway.emitToFolder(SOCKET_EVENTS.FOLDER_DELETED, folder);

    return this.databaseService.folder.delete({ where: { id: folderId } });
  }

  /**
   * Renames a folder.
   */
  async renameFolder({
    userId,
    folderId,
    newName,
  }: {
    userId: string;
    folderId: string;
    newName: string;
  }) {
    await this.checkFolderPermission({
      userId,
      requiredRoles: ['ADMIN', 'EDITOR'],
      folderId,
    });

    this.logger.log(`Renaming folder to: ${newName}`);

    const folder = await this.databaseService.folder.update({
      where: { id: folderId },
      data: { name: newName },
    });

    this.folderGateway.emitToFolder(SOCKET_EVENTS.FOLDER_RENAMED, folder);

    return folder;
  }

  /**
   * Retrieves parent folders recursively.
   */
  async getParentFolders(
    workspaceId: string,
    userId: string,
    folderId: string,
  ) {
    await this.validateMembership({ workspaceId, userId });

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

  async moveFolder(
    userId: string,
    folderId: string,
    destination: {
      id: string;
      type: 'folder' | 'space' | 'workspace';
    },
  ) {
    this.logger.debug(`moveFolder: ${folderId} to ${destination.id}`);

    const sourceFolder = await this.checkFolderPermission({
      userId,
      requiredRoles: ['ADMIN'],
      folderId,
    });

    if (!sourceFolder) {
      throw new NotFoundException('Folder not found.');
    }

    // Prevent moving folders across workspaces (optional)
    // TODO: Only for paid customers
    if (
      destination.type === 'workspace' &&
      destination.id !== sourceFolder.workspaceId
    ) {
      throw new BadRequestException(
        'Moving folders across workspaces is not supported.',
      );
    }

    const updateData: Record<string, any> = {
      parentFolderId: null,
      spaceId: null,
    };

    if (destination.type === 'folder') {
      await this.checkFolderPermission({
        requiredRoles: ['ADMIN'],
        userId,
        folderId: destination.id,
      });
      updateData.parentFolderId = destination.id;
    } else if (destination.type === 'space') {
      await this.checkWorkspacePermission({
        requiredRoles: ['ADMIN'],
        userId,
        spaceId: destination.id,
        workspaceId: sourceFolder.workspaceId,
      });
      updateData.spaceId = destination.id;
    }

    const folder = await this.databaseService.folder.update({
      where: { id: folderId },
      data: updateData,
    });

    this.folderGateway.emitToFolder(SOCKET_EVENTS.FOLDER_CREATED, folder);
    this.folderGateway.emitToFolder(SOCKET_EVENTS.FOLDER_DELETED, folder);
  }

  async searchFolder({
    query,
    userId,
    workspaceId,
    limit = '10',
    direction = 'searchAfter',
    paginationToken,
  }: {
    workspaceId: string;
    query: string;
    userId: string;
    limit: string;
    direction?: 'searchAfter' | 'searchBefore';
    paginationToken?: string;
  }) {
    await this.validateMembership({ workspaceId, userId });

    // Return empty array if no query
    if (!query || query.trim() === '') return { results: [] };

    // Fetch accessible spaceIds
    const member = await this.databaseService.member.findUnique({
      where: {
        id: userId,
        workspaceId,
      },
      select: {
        spaceIds: true,
      },
    });

    // Convert spaceIds to MongoDB ObjectId format
    const spaceObjectIds = member.spaceIds.map((spaceId) => ({
      $oid: spaceId,
    }));

    // Search folders with Atlas Search
    const searchStage: any = {
      $search: {
        index: 'default',
        compound: {
          must: [
            {
              in: {
                path: 'spaceId',
                value: spaceObjectIds,
              },
            },
            {
              autocomplete: {
                query,
                path: 'name',
                tokenOrder: 'any',
                fuzzy: { maxEdits: 1 },
              },
            },
          ],
        },
      },
    };

    // Add searchAfter if provided
    if (paginationToken) {
      searchStage.$search[direction] = paginationToken;
    }

    // Execute search with pagination
    const folders = await this.databaseService.folder
      .aggregateRaw({
        pipeline: [
          searchStage,
          { $limit: parseInt(limit) },
          {
            $project: {
              name: 1,
              spaceId: 1,
              _id: 0,
              score: { $meta: 'searchScore' },
              createdAt: { $toString: '$createdAt' },
            },
          },
        ],
      })
      .catch((error) => {
        console.error('Search failed:', error);
        throw new Error('Folder search failed');
      });

    return { results: folders };
  }
}
