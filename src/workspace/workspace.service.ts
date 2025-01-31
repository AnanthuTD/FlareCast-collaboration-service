import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService, Topics } from 'src/kafka/kafka.service';
import { emailSchema } from 'src/schema/email.schema';

@Injectable()
export class WorkspaceService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceService.name);

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
          // if (message.key === 'user-created') {
          const { userId, firstName } = message.value;
          this.logger.log(`User created: ${userId}`);

          // Create default workspace
          await this.databaseService.workSpace.create({
            data: {
              userId,
              name: `${firstName}'s Workspace`,
              type: 'PERSONAL',
            },
          });
          // }
        },
      );
    } catch (error) {
      this.logger.error('Failed to subscribe to Kafka topic:', error.message);
    }
  }

  // Create a new workspace
  async create(createWorkspaceDto: {
    name: string;
    userId: string;
    members?: string[];
  }) {
    if (createWorkspaceDto.members.length > 0) {
      for (const email of createWorkspaceDto.members) {
        try {
          emailSchema.parse({ email });
        } catch {
          throw new BadRequestException('Invalid email address: ' + email);
        }
      }
    }

    const workSpace = await this.databaseService.workSpace.create({
      data: {
        name: createWorkspaceDto.name,
        userId: createWorkspaceDto.userId,
      },
    });

    try {
      if (createWorkspaceDto.members.length > 0) {
        const users = await this.databaseService.user.findMany({
          where: { email: { in: createWorkspaceDto.members } },
          select: { id: true },
        });

        await this.databaseService.invite.createMany({
          data: users.map((user) => ({
            workspaceId: workSpace.id,
            senderId: createWorkspaceDto.userId,
            receiverId: user.id,
          })),
        });

        const invitationData = {
          workspaceId: workSpace.id,
          workspaceName: workSpace.name,
          senderId: createWorkspaceDto.userId,
          receiverEmail: createWorkspaceDto.members,
        };

        this.kafkaService.sendMessageToTopic(
          Topics.WORKSPACE_INVITATION,
          'Invitation',
          invitationData,
        );
      }

      return workSpace;
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

    this.logger.log(folder);

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
      this.logger.error('Failed to find parent folders', error);
      return { parentFolders: [] };
    }
  }

  async userHasInviteAuthority(workspaceId: string, userId: string) {
    const workSpace = await this.databaseService.workSpace.findFirst({
      where: { id: workspaceId, userId },
    });

    return workSpace;
  }

  async inviteMembers(workspaceId: string, userId: string, invites: string[]) {
    try {
      // Check if the user has authority to invite members
      const workspaceData = await this.userHasInviteAuthority(
        workspaceId,
        userId,
      );

      if (!workspaceData) {
        throw new Error('User does not have authority to invite members');
      }

      // Find users with the provided emails
      const users = await this.databaseService.user.findMany({
        where: { email: { in: invites } },
      });

      if (!users.length) {
        throw new Error(
          `No valid email addresses found: ${invites.join(', ')}`,
        );
      }

      // Find existing members in the workspace
      const members = await this.databaseService.member.findMany({
        where: {
          workspaceId,
          userId: { in: users.map((user) => user.id) },
        },
      });

      // Filter out users who are already members
      const notJoined = users.filter(
        (user) => !members.some((member) => member.userId === user.id),
      );

      // Send invitations to users who are not already members
      for (const user of notJoined) {
        const existingInvite = await this.databaseService.invite.findFirst({
          where: { workspaceId, receiverId: user.id },
        });

        if (!existingInvite) {
          await this.databaseService.invite.create({
            data: {
              workspaceId,
              senderId: userId,
              receiverId: user.id,
            },
          });
        } else {
          await this.databaseService.invite.update({
            where: { id: existingInvite.id },
            data: { updatedAt: new Date() },
          });
        }
      }

      // Send Kafka message for invitations
      await this.kafkaService.sendMessageToTopic(
        Topics.WORKSPACE_INVITATION,
        'Invitation',
        {
          invites: notJoined.map((user) => user.email),
          workspaceName: workspaceData.name,
        },
      );

      // Return success response
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to invite members: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to invite members: ${error.message}`,
      );
    }
  }
}
