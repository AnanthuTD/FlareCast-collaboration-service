import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService, Topics } from 'src/kafka/kafka.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ValidationService } from 'src/common/validations/validations.service';
import { Member } from '@prisma/client';

export enum NOTIFICATION_EVENT_TYPE {
  FIRST_VIEW = 'firstView',
  COMMENT = 'comment',
  TRANSCRIPT_SUCCESS = 'transcript_success',
  TRANSCRIPT_FAILURE = 'transcript_failure',
  WORKSPACE_REMOVE = 'workspace_remove',
  WORKSPACE_DELETE = 'workspace_delete',
  VIDEO_SHARE = 'video_share',
  WORKSPACE_INVITATION = 'workspace_invitation',
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

            await this.databaseService.$transaction(async (tx) => {
              tx.user.upsert({
                where: { id: userId },
                create: { email, name: firstName, id: userId },
                update: { name: firstName },
              });

              // create default workspace
              const workspace = await tx.workSpace.create({
                data: {
                  userId,
                  name: `${firstName}'s Workspace`,
                  type: 'PERSONAL',
                },
              });

              await tx.space.create({
                data: {
                  workspaceId: workspace.id,
                  name: workspace.name,
                  type: 'DEFAULT',
                },
              });

              await tx.user.update({
                where: { id: userId },
                data: {
                  selectedWorkspace: workspace.id,
                },
              });
            });
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

        await tx.member.create({
          data: {
            workspaceId: workSpace.id,
            userId: createWorkspaceDto.userId,
            role: 'ADMIN',
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

        if (invitationData.length !== 0) {
          // Bulk insert invitations
          await tx.invite.createMany({ data: invitationData });

          // Fetch inserted data manually since createMany() doesn’t return records
          const insertedInvites = await tx.invite.findMany({
            where: {
              receiverEmail: {
                in: invitationData.map((inv) => inv.receiverEmail),
              },
            },
            select: { id: true, receiverEmail: true, receiverId: true },
          });

          // Prepare Kafka notification payload
          const invites: WorkspaceInvitationNotificationEvent['invites'] =
            insertedInvites.map((invite) => ({
              receiverEmail: invite.receiverEmail,
              url: `${process.env.FRONTEND_INVITATION_ROUTE ?? ''}?token=${invite.id}`,
              receiverId: invite?.receiverId,
              invitationId: invite.id,
            }));

          // Send Kafka notification
          this.kafkaService.sendMessageToTopic(
            Topics.NOTIFICATION_EVENT,
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
      this.logger.log(`Fetching workspaces for user: ${userId}`);

      // Fetch workspaces where user is either an owner or a member
      const workspaces = await this.databaseService.workSpace.findMany({
        where: {
          OR: [
            { userId }, // Workspaces owned by the user
            { members: { some: { userId } } },
          ],
        },
      });

      // Transform data to include `owned` field
      const workspaceList = workspaces.map((ws) => ({
        ...ws,
        owned: ws.userId === userId, // Mark as owned if user is the creator
      }));

      return { member: workspaceList, owned: [{}] };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve workspaces for user: ${userId}`,
        error.stack,
      );
      throw new InternalServerErrorException(`Failed to retrieve workspaces`);
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

  async getWorkspaceMembers(workspaceId: string) {
    try {
      const workspace = await this.databaseService.workSpace.findUnique({
        where: { id: workspaceId },
        include: {
          members: {
            include: {
              User: {
                select: { name: true },
              },
            },
          },
        },
      });
      if (!workspace) {
        throw new NotFoundException(
          `Workspace with ID ${workspaceId} not found`,
        );
      }
      return workspace.members;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve workspace members: ${error.message}`,
      );
    }
  }

  async updateRole(
    userId: string,
    workspaceId: string,
    role: Member['role'],
    memberId: string,
  ) {
    // Validate if the user is an admin
    const userDetails = await this.databaseService.member.findFirst({
      where: { workspaceId, userId, role: 'ADMIN' },
    });

    if (!userDetails) {
      throw new ForbiddenException('Only admins can update roles');
    }

    // Fetch the member directly with a workspace check
    const member = await this.databaseService.member.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!member) {
      throw new NotFoundException(
        `Member with ID ${memberId} not found in this workspace`,
      );
    }

    // Prevent self-role change
    if (userDetails.id === member.id) {
      throw new ForbiddenException('Admins cannot change their own role');
    }

    if (member.role === 'ADMIN') {
      // Only the owner can demote an ADMIN
      const isOwner = await this.databaseService.workSpace.findFirst({
        where: { id: workspaceId, userId },
      });

      if (!isOwner) {
        throw new ForbiddenException(
          'Only the workspace owner can update an admin’s role',
        );
      }
    }

    await this.databaseService.member.update({
      where: { id: memberId },
      data: { role },
    });

    return { message: 'Member role updated successfully' };
  }

  async removeMember(workspaceId: string, userId: string, memberId: string) {
    // Check if user has admin privileges
    const userDetails = await this.databaseService.member.findFirst({
      where: { workspaceId, userId, role: 'ADMIN' },
    });

    if (!userDetails) {
      throw new ForbiddenException('Only admins can remove members');
    }

    // Fetch member ensuring it belongs to the workspace
    const member = await this.databaseService.member.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this workspace');
    }

    this.logger.debug('member Information: ', JSON.stringify(member));

    // Prevent removing ADMINs unless the owner is doing it
    if (member.role === 'ADMIN') {
      const isOwner = await this.databaseService.workSpace.findFirst({
        where: { id: workspaceId, userId },
      });

      if (!isOwner) {
        throw new ForbiddenException('Only the owner can remove an admin');
      }

      if (userDetails.id === member.id) {
        throw new ForbiddenException('Cannot remove owner of the workspace!');
      }
    }

    await this.databaseService.member.delete({
      where: { id: memberId },
    });

    return { message: 'Successfully removed member from workspace' };
  }

  async getSelectedWorkspace(
    userId: string,
    workspaceId?: string,
    folderId?: string,
  ) {
    if (workspaceId) {
      // Find the workspace with the given ID where the user is a member
      const workspace = await this.databaseService.workSpace.findFirst({
        where: {
          id: workspaceId,
          members: {
            some: {
              userId,
            },
          },
        },
        select: { id: true },
      });

      // If the workspace exists, check for the folder
      if (workspace) {
        const folder = folderId
          ? await this.databaseService.folder.findUnique({
              where: { id: folderId, workspaceId },
              select: { id: true },
            })
          : null;

        return {
          selectedWorkspace: workspace.id,
          selectedFolder: folder ? folder.id : null,
          message: `Workspace ${workspace.id} is selected. ${
            folder ? `Folder ${folder.id} is selected.` : 'No folder selected.'
          }`,
        };
      }
    }

    // Find the user's selected workspace
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { selectedWorkspace: true },
    });

    // If user doesn't exist, throw an error
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // If the user has a selected workspace, return it
    if (user.selectedWorkspace) {
      return {
        selectedWorkspace: user.selectedWorkspace,
        message: `Workspace ${user.selectedWorkspace} is selected`,
      };
    }

    // If no selected workspace, find the first one owned by the user
    const defaultWorkspace = await this.databaseService.workSpace.findFirst({
      where: { userId },
      select: { id: true },
    });

    return {
      selectedWorkspace: defaultWorkspace?.id || null,
      message: defaultWorkspace
        ? `No selected workspace found. Default workspace ${defaultWorkspace.id} assigned.`
        : 'No workspace found for this user.',
    };
  }

  async searchMembers(
    workspaceId: string,
    spaceId: string,
    query: string,
    userId: string,
  ) {
    if (!query.trim()) {
      return [];
    }

    // Use MongoDB Atlas Full-Text Search via `aggregateRaw`
    const result = await this.databaseService.user.aggregateRaw({
      pipeline: [
        {
          $search: {
            index: 'name', // Ensure this matches your search index name
            autocomplete: {
              query: query,
              path: 'name',
              fuzzy: { maxEdits: 1 }, // Allows minor typos
            },
          },
        },
        {
          $lookup: {
            from: 'Member',
            localField: '_id',
            foreignField: 'userId',
            as: 'membership',
          },
        },
        {
          $match: {
            'membership.workspaceId': { $oid: workspaceId },
            'membership.userId': { $ne: { $oid: userId } },
          },
        },
        ...(spaceId
          ? [
              {
                $lookup: {
                  from: 'Member',
                  localField: '_id',
                  foreignField: 'userId',
                  as: 'spaceMembership',
                },
              },
              {
                $match: {
                  'spaceMembership.spaceId': { $ne: { $oid: spaceId } }, // Exclude users already in the space
                },
              },
            ]
          : []),
        {
          $project: {
            id: { $toString: '$_id' },
            name: 1,
            email: 1,
            role: { $arrayElemAt: ['$membership.role', 0] },
            createdAt: { $arrayElemAt: ['$membership.createdAt', 0] },
          },
        },
        {
          $limit: 10, // Prevents large query loads
        },
      ],
    });

    return {
      members: result,
      message: `Found ${result.length} members matching "${query}", excluding those already in space "${spaceId}".`,
    };
  }
}
