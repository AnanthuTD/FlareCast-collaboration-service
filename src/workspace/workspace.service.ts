import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class WorkspaceService implements OnModuleInit {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
  ) {}

  /* listen to user-created topic and create a new personal workspace for every new user */
  async onModuleInit() {
    try {
      await this.kafkaService.subscribeToTopic(
        'user-events',
        async (message) => {
          if (message.key === 'user-created') {
            const { userId, firstName } = message.value;
            console.log(`User created: ${userId}`);

            // Create default workspace
            await this.databaseService.workSpace.create({
              data: {
                userId,
                name: `${firstName}'s Workspace`,
                type: 'PERSONAL',
              },
            });
          }
        },
      );
    } catch (error) {
      console.error('Failed to subscribe to Kafka topic:', error.message);
    }
  }

  // Create a new workspace
  async create(createWorkspaceDto: Prisma.WorkSpaceCreateInput) {
    try {
      return await this.databaseService.workSpace.create({
        data: createWorkspaceDto,
      });
    } catch (error) {
      throw new Error(`Failed to create workspace: ${error.message}`);
    }
  }

  // Find all workspaces
  async findAll() {
    try {
      return await this.databaseService.workSpace.findMany();
    } catch (error) {
      throw new Error(`Failed to retrieve workspaces: ${error.message}`);
    }
  }

  async findByUser(userId: string) {
    try {
      const owned = await this.databaseService.workSpace.findMany({
        where: {
          userId,
        },
      });
      const member = await this.databaseService.workSpace.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
      });

      return { owned, member };
    } catch (error) {
      throw new Error(`Failed to retrieve workspaces: ${error.message}`);
    }
  }

  // Find a single workspace by ID
  async findOne(id: string) {
    try {
      const workspace = await this.databaseService.workSpace.findUnique({
        where: { id },
      });
      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }
      return workspace;
    } catch (error) {
      throw new Error(`Failed to retrieve workspace: ${error.message}`);
    }
  }

  // Update a workspace by ID
  async update(id: string, updateWorkspaceDto: Prisma.WorkSpaceUpdateInput) {
    try {
      const existingWorkspace = await this.databaseService.workSpace.findUnique(
        {
          where: { id },
        },
      );

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      return await this.databaseService.workSpace.update({
        where: { id },
        data: updateWorkspaceDto,
      });
    } catch (error) {
      throw new Error(`Failed to update workspace: ${error.message}`);
    }
  }

  // Remove a workspace by ID
  async remove(id: string) {
    try {
      const existingWorkspace = await this.databaseService.workSpace.findUnique(
        {
          where: { id },
        },
      );

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      return await this.databaseService.workSpace.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }
  }

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
          {
            id: workspaceId,
            userId: userId,
          },
          {
            id: workspaceId,
            members: {
              some: { userId },
            },
          },
        ],
      },
    }));
  }

  async findFolders(workspaceId: string, userId: string, folderId?: string) {
    if (!(await this.isUserMemberOfWorkspace({ workspaceId, userId }))) {
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
    if (!(await this.isUserMemberOfWorkspace({ workspaceId, userId }))) {
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

    console.log(folder);

    return folder;
  }

  async deleteFolder(workspaceId: string, userId: string, folderId: string) {
    if (!(await this.isUserMemberOfWorkspace({ workspaceId, userId }))) {
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
    if (!(await this.isUserMemberOfWorkspace({ workspaceId, userId }))) {
      throw new NotFoundException(
        'User is not a member of the workspace or the workspace does not exist',
      );
    }

    console.log(newName);

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
      if (!(await this.isUserMemberOfWorkspace({ workspaceId, userId }))) {
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
      console.error('Failed to find parent folders', error);
      return { parentFolders: [] };
    }
  }
}
