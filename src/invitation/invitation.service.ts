import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Invite } from '@prisma/client';
import { ValidationService } from 'src/common/validations/validations.service';
import { WorkspaceMemberService } from 'src/common/workspace-member.service';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService, Topics } from 'src/kafka/kafka.service';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
    private readonly workspaceMemberService: WorkspaceMemberService,
    private readonly validationService: ValidationService,
  ) {}

  async create(workspaceId: string, userId: string, invites: string[]) {
    try {
      // Check if the user has authority to invite members
      const workspaceData =
        await this.workspaceMemberService.userHasInviteAuthority({
          workspaceId,
          userId,
        });
      if (!workspaceData) {
        throw new ForbiddenException(
          'User does not have authority to invite members',
        );
      }

      // Ensure valid emails before proceeding
      for (const email of invites) {
        this.validationService.validate('email', { email });
      }

      return await this.databaseService.$transaction(async (tx) => {
        // Fetch existing users based on email
        const users = await tx.user.findMany({
          where: { email: { in: invites } },
          select: { id: true, email: true },
        });

        // Get existing members in the workspace
        const existingMembers = await tx.member.findMany({
          where: {
            workspaceId,
            userId: { in: users.map((user) => user.id) },
          },
          select: { userId: true },
        });

        const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

        // Filter out already joined users
        const registeredUsersToInvite = users.filter(
          (user) => !existingMemberIds.has(user.id),
        );

        // Get emails of unregistered users
        const registeredEmails = new Set(users.map((user) => user.email));
        const unregisteredEmails = invites.filter(
          (email) => !registeredEmails.has(email),
        );

        // Fetch existing invites (to prevent duplicates)
        const existingInvites = await tx.invite.findMany({
          where: {
            workspaceId,
            OR: [
              { receiverId: { in: registeredUsersToInvite.map((u) => u.id) } },
              { receiverEmail: { in: unregisteredEmails } },
            ],
          },
          select: { receiverId: true, receiverEmail: true },
        });

        const existingInviteIds = new Set(
          existingInvites.map((i) => i.receiverId),
        );
        const existingInviteEmails = new Set(
          existingInvites.map((i) => i.receiverEmail),
        );

        // Prepare new invitations
        const invitesToCreate = [
          ...registeredUsersToInvite
            .filter((user) => !existingInviteIds.has(user.id))
            .map((user) => ({
              workspaceId,
              senderId: userId,
              receiverId: user.id,
              receiverEmail: user.email,
              invitationStatus: 'PENDING',
            })),

          ...unregisteredEmails
            .filter((email) => !existingInviteEmails.has(email))
            .map((email) => ({
              workspaceId,
              senderId: userId,
              receiverEmail: email,
              invitationStatus: 'PENDING',
            })),
        ] as unknown as Invite[];

        if (invitesToCreate.length > 0) {
          await tx.invite.createMany({
            data: invitesToCreate,
          });
        }

        // Send Kafka message for invitations
        await this.kafkaService.sendMessageToTopic(
          Topics.WORKSPACE_INVITATION,
          'Invitation',
          {
            invites: invitesToCreate.map((invite) => invite.receiverEmail),
            workspaceName: workspaceData.name,
          },
        );

        return { success: true, invitedCount: invitesToCreate.length };
      });
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
