import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService, Topics } from 'src/kafka/kafka.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ValidationService } from 'src/common/validations/validations.service';

export enum NOTIFICATION_EVENT_TYPE {
  FIRST_VIEW = 'firstView',
  COMMENT = 'comment',
  TRANSCRIPT_SUCCESS = 'transcript-success',
  TRANSCRIPT_FAILURE = 'transcript-failure',
  WORKSPACE_REMOVE = 'workspace-remove',
  WORKSPACE_DELETE = 'workspace-delete',
  VIDEO_SHARE = 'video-share',
  WORKSPACE_INVITATION = 'workspace-invitation',
}

export interface WorkspaceInvitationNotificationEvent {
  eventType: NOTIFICATION_EVENT_TYPE.WORKSPACE_INVITATION;
  senderId: string;
  invites: {
    receiverEmail: string;
    url: string;
    receiverId?: string;
  }[];
  workspaceId: string;
  workspaceName: string;
  timestamp: number;
}

@Injectable()
export class WorkspaceService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
    private readonly validationService: ValidationService,
  ) {}

  /* listen to user-created topic and create a new personal workspace for every new user */
  async onModuleInit() {
    try {
      await this.kafkaService.subscribeToTopic(
        'user-events',
        async (topic, message) => {
          if (topic === 'user-events') {
            const { userId, firstName, email } = message.value;
            this.logger.log(`User created: ${userId}`);

            await this.databaseService.$transaction([
              this.databaseService.user.upsert({
                where: { id: userId },
                create: { email, name: firstName, id: userId },
                update: { name: firstName },
              }),

              // create default workspace
              this.databaseService.workSpace.create({
                data: {
                  userId,
                  name: `${firstName}'s Workspace`,
                  type: 'PERSONAL',
                },
              }),
            ]);
          }
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
    // Validate userId before proceeding
    const userExists = await this.databaseService.user.findUnique({
      where: { id: createWorkspaceDto.userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new BadRequestException('Invalid userId: User does not exist.');
    }

    const members = createWorkspaceDto.members ?? [];

    // Validate emails before proceeding
    for (const email of members) {
      this.validationService.validate('email', { email });
    }

    try {
      return await this.databaseService.$transaction(async (tx) => {
        // Create workspace
        const workSpace = await tx.workSpace.create({
          data: {
            name: createWorkspaceDto.name,
            userId: createWorkspaceDto.userId,
          },
        });

        if (members.length === 0) return workSpace;

        // Find existing users by email
        const users = await tx.user.findMany({
          where: { email: { in: members } },
          select: { id: true, email: true },
        });

        const existingUserEmails = new Set(users.map((u) => u.email));
        const unregisteredMembers = members.filter(
          (email) => !existingUserEmails.has(email),
        );

        const invitationData = [];

        // Insert invitations for registered users
        if (users.length > 0) {
          invitationData.push(
            ...users.map((user) => ({
              workspaceId: workSpace.id,
              senderId: createWorkspaceDto.userId,
              receiverId: user.id,
              receiverEmail: user.email,
              invitationStatus: 'PENDING',
            })),
          );
        }

        // Insert invitations for unregistered users
        if (unregisteredMembers.length > 0) {
          invitationData.push(
            ...unregisteredMembers.map((email) => ({
              workspaceId: workSpace.id,
              senderId: createWorkspaceDto.userId,
              receiverEmail: email,
              invitationStatus: 'PENDING',
            })),
          );
        }

        // Bulk insert invitations
        if (invitationData.length > 0) {
          await tx.invite.createMany({ data: invitationData });
        }

        // Send Kafka notification if invitations were created
        if (invitationData.length > 0) {
          const invites: WorkspaceInvitationNotificationEvent['invites'] =
            invitationData.map((invite) => ({
              receiverEmail: invite.receiverEmail,
              url: `${process.env.COLLABORATION_HOST_URL ?? ''}/invitation?token=${invite.workspaceId}`,
              receiverId: invite?.receiverId,
            }));

          this.kafkaService.sendMessageToTopic(
            Topics.WORKSPACE_INVITATION,
            'Invitation',
            {
              workspaceId: workSpace.id,
              workspaceName: workSpace.name,
              senderId: createWorkspaceDto.userId,
              invites,
              eventType: NOTIFICATION_EVENT_TYPE.WORKSPACE_INVITATION,
              timestamp: Date.now(),
            } as WorkspaceInvitationNotificationEvent,
          );
        }

        return workSpace;
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to create workspace: ${error.message}`,
      );
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
  async update(data: UpdateWorkspaceDto) {
    try {
      const existingWorkspace = await this.databaseService.workSpace.findUnique(
        {
          where: { id: data.id },
        },
      );

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${data.id} not found`);
      }

      return await this.databaseService.workSpace.update({
        where: { id: data.id },
        data: data.updateWorkspaceDto,
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
}
