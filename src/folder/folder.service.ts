import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async findFolders(workspaceId: string, userId: string, folderId?: string) {
    if (
      !(await this.workspaceMemberService.isUserMemberOfWorkspace({
        workspaceId,
        userId,
      }))
    ) {
      throw new NotFoundException(
        'User is not a member of the workspace or the workspace does not exist',
      );
    }

    if (folderId) {
      return await this.databaseService.folder.findMany({
        where: {
          workspaceId,
          parentFolderId: folderId,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          workspaceId: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return await this.databaseService.folder.findMany({
      where: {
        workspaceId,
        parentFolderId: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        workspaceId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createFolder(workspaceId: string, userId: string, folderId?: string) {
    if (
      !(await this.workspaceMemberService.isUserMemberOfWorkspace({
        workspaceId,
        userId,
      }))
    ) {
      throw new NotFoundException(
        'User is not a member of the workspace or the workspace does not exist',
      );
    }

    const folder = await this.databaseService.folder.create({
      data: {
        workspaceId,
        name: 'Untitled Folder',
        parentFolderId: folderId || null,
      },
    });

    this.logger.log(folder);

    return folder;
  }

  async deleteFolder(workspaceId: string, userId: string, folderId: string) {
    if (
      !(await this.workspaceMemberService.isUserMemberOfWorkspace({
        workspaceId,
        userId,
      }))
    ) {
      throw new NotFoundException(
        'User is not a member of the workspace or the workspace does not exist',
      );
    }

    this.databaseService.folder.deleteMany({
      where: { parentFolderId: folderId },
    });

    return await this.databaseService.folder.delete({
      where: { id: folderId },
    });
  }

  async renameFolder(
    workspaceId: string,
    userId: string,
    folderId: string,
    newName: string,
  ) {
    if (
      !(await this.workspaceMemberService.isUserMemberOfWorkspace({
        workspaceId,
        userId,
      }))
    ) {
      throw new NotFoundException(
        'User is not a member of the workspace or the workspace does not exist',
      );
    }

    this.logger.log(newName);

    return await this.databaseService.folder.update({
      where: { id: folderId },
      data: { name: newName },
    });
  }

  async getParentFolders(
    workspaceId: string,
    userId: string,
    folderId: string,
  ) {
    try {
      if (
        !(await this.workspaceMemberService.isUserMemberOfWorkspace({
          workspaceId,
          userId,
        }))
      ) {
        throw new NotFoundException(
          'User is not a member of the workspace or the workspace does not exist',
        );
      }

      const currentFolder = await this.databaseService.folder.findUnique({
        where: { id: folderId },
        select: {
          parentFolderId: true,
          name: true,
          createdAt: true,
          workspaceId: true,
          id: true,
        },
      });

      if (!currentFolder) {
        return { parentFolders: [] };
      }

      if (!currentFolder.parentFolderId) {
        return { parentFolders: [currentFolder] };
      }

      let parentFolder = currentFolder;

      const parentFolders = [parentFolder];

      while (parentFolder.parentFolderId) {
        parentFolder = await this.databaseService.folder.findUnique({
          where: { id: parentFolder.parentFolderId },
          select: {
            id: true,
            name: true,
            createdAt: true,
            workspaceId: true,
            parentFolderId: true,
          },
        });
        parentFolders.unshift(parentFolder);
      }

      return { parentFolders };
    } catch (error) {
      this.logger.error('Failed to find parent folders', error);
      return { parentFolders: [] };
    }
  }
}
