import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Invite } from '@prisma/client';
import { ValidationService } from 'src/common/validations/validations.service';
import { WorkspaceMemberService } from 'src/common/workspace-member.service';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService, Topics } from 'src/kafka/kafka.service';
import {
  NOTIFICATION_EVENT_TYPE,
  WorkspaceInvitationNotificationEvent,
} from 'src/workspace/workspace.service';

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
      // ✅ Check user authorization
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

      // ✅ Validate all emails in one go
      invites.forEach((email) =>
        this.validationService.validate('email', { email }),
      );

      return await this.databaseService.$transaction(async (tx) => {
        // ✅ Fetch existing users in a single query
        const users = await tx.user.findMany({
          where: { email: { in: invites } },
          select: { id: true, email: true },
        });

        // ✅ Get existing workspace members
        const existingMembers = new Set(
          (
            await tx.member.findMany({
              where: {
                workspaceId,
                userId: { in: users.map((user) => user.id) },
              },
              select: { userId: true },
            })
          ).map((member) => member.userId),
        );

        // ✅ Filter registered users who are NOT already in the workspace
        const registeredUsersToInvite = users.filter(
          (user) => !existingMembers.has(user.id),
        );

        // ✅ Get emails of unregistered users
        const registeredEmails = new Set(users.map((user) => user.email));
        const unregisteredEmails = invites.filter(
          (email) => !registeredEmails.has(email),
        );

        // ✅ Fetch existing invites (to prevent duplicate invites)
        const existingInvites = await tx.invite.findMany({
          where: {
            workspaceId,
            OR: [
              { receiverId: { in: registeredUsersToInvite.map((u) => u.id) } },
              { receiverEmail: { in: unregisteredEmails } },
            ],
            invitationStatus: 'PENDING',
          },
          select: { receiverId: true, receiverEmail: true },
        });

        const existingInviteIds = new Set(
          existingInvites.map((i) => i.receiverId),
        );
        const existingInviteEmails = new Set(
          existingInvites.map((i) => i.receiverEmail),
        );

        // ✅ Prepare new invitations
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
          // ✅ Bulk insert invitations
          await tx.invite.createMany({ data: invitesToCreate });

          // ✅ Fetch inserted invites manually since createMany() doesn't return them
          const insertedInvites = await tx.invite.findMany({
            where: {
              workspaceId,
              receiverEmail: {
                in: invitesToCreate.map((i) => i.receiverEmail),
              },
            },
            select: { id: true, receiverEmail: true, receiverId: true },
          });

          // ✅ Send Kafka Notification
          await this.kafkaService.sendMessageToTopic(
            Topics.NOTIFICATION_EVENT,
            'Invitation',
            {
              workspaceId: workspaceData.id,
              workspaceName: workspaceData.name,
              senderId: userId,
              invites: insertedInvites.map((invite) => ({
                receiverEmail: invite.receiverEmail,
                url: `${process.env.FRONTEND_INVITATION_ROUTE ?? ''}?token=${invite.id}`,
                receiverId: invite.receiverId,
                invitationId: invite.id,
              })),
              eventType: NOTIFICATION_EVENT_TYPE.WORKSPACE_INVITATION,
              timestamp: Date.now(),
            } as WorkspaceInvitationNotificationEvent,
          );
        }

        return {
          success: true,
          invitedCount: invitesToCreate.length,
          message: 'Invitation send successfully',
        };
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

  async accept(token: string) {
    if (!token) throw new BadRequestException('Token is required');

    return await this.databaseService.$transaction(async (tx) => {
      // Step 1: Fetch invitation details
      const invitation = await tx.invite.findUnique({
        where: { id: token },
        select: { workspaceId: true, receiverId: true, receiverEmail: true },
      });

      if (!invitation) throw new NotFoundException('Invitation not found!');

      let receiverId = invitation.receiverId;

      // Step 2: If user is not registered, try to find user by email. there is a chance that user has registered after registering
      if (!receiverId) {
        const user = await tx.user.findFirst({
          where: { email: invitation.receiverEmail },
          select: { id: true },
        });

        this.logger.debug('User: ', JSON.stringify(user, null, 2));

        if (!user)
          throw new NotFoundException('User not found! Please sign up!');

        receiverId = user.id;

        // Step 3: Update all pending invites for this email
        await tx.invite.updateMany({
          where: { receiverEmail: invitation.receiverEmail },
          data: { receiverId: receiverId },
        });
      }

      // Step 4: Ensure the user is not already a member
      const existingMember = await tx.member.findFirst({
        where: { workspaceId: invitation.workspaceId, userId: receiverId },
      });

      if (existingMember) {
        throw new ConflictException(
          'User is already a member of this workspace',
        );
      }

      // Step 5: Mark invitation as accepted
      await tx.invite.update({
        where: { id: token },
        data: { invitationStatus: 'ACCEPTED' },
      });

      // Step 6: Add the user as a workspace member
      await tx.member.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: receiverId,
        },
      });

      this.kafkaService.sendMessageToTopic(
        Topics.INVITATION_STATUS_UPDATE,
        'Invitation',
        {
          invitationId: token,
          invitationStatus: 'ACCEPTED',
        },
      );

      return {
        success: true,
        message: 'Invite has successfully been accepted',
        id: token,
        invitationStatus: 'ACCEPTED',
      };
    });
  }

  async decline(token: string) {
    if (!token) throw new BadRequestException('Token is required');
    const rejectedInvitation = await this.databaseService.invite.update({
      where: { id: token },
      data: { invitationStatus: 'REJECTED' },
      select: { invitationStatus: true, id: true },
    });

    if (!rejectedInvitation)
      throw new BadRequestException('Invitation not found');

    this.kafkaService.sendMessageToTopic(
      Topics.INVITATION_STATUS_UPDATE,
      'Invitation',
      {
        invitationId: rejectedInvitation.id,
        invitationStatus: rejectedInvitation.invitationStatus,
      },
    );

    return {
      ...rejectedInvitation,
      message: 'Invite has been successfully rejected',
    };
  }
}
