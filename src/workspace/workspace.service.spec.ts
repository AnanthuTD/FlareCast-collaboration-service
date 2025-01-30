import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService, Topics } from 'src/kafka/kafka.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let databaseService: DatabaseService;
  let kafkaService: KafkaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: DatabaseService,
          useValue: {
            user: {
              findMany: jest.fn(),
            },
            member: {
              findMany: jest.fn(),
            },
            invite: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: KafkaService,
          useValue: {
            sendMessageToTopic: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    kafkaService = module.get<KafkaService>(KafkaService);

    // Mock the userHasInviteAuthority method
    service.userHasInviteAuthority = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('inviteMembers', () => {
    const workspaceId = 'workspace-123';
    const userId = 'user-123';
    const invites = ['user1@example.com', 'user2@example.com'];

    it('should successfully invite members', async () => {
      // Mock userHasInviteAuthority to return workspace data
      (service.userHasInviteAuthority as jest.Mock).mockResolvedValue({
        id: workspaceId,
        name: 'Test Workspace',
      });

      // Mock database responses
      (databaseService.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-456', email: 'user1@example.com' },
        { id: 'user-789', email: 'user2@example.com' },
      ]);
      (databaseService.member.findMany as jest.Mock).mockResolvedValue([]);
      (databaseService.invite.findFirst as jest.Mock).mockResolvedValue(null);
      (databaseService.invite.create as jest.Mock).mockResolvedValue({});
      (kafkaService.sendMessageToTopic as jest.Mock).mockResolvedValue(true);

      const result = await service.inviteMembers(workspaceId, userId, invites);

      expect(result).toEqual({ success: true });
      expect(service.userHasInviteAuthority).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
      expect(databaseService.user.findMany).toHaveBeenCalledWith({
        where: { email: { in: invites } },
      });
      expect(databaseService.member.findMany).toHaveBeenCalledWith({
        where: { workspaceId, userId: { in: ['user-456', 'user-789'] } },
      });
      expect(databaseService.invite.create).toHaveBeenCalledTimes(2);
      expect(kafkaService.sendMessageToTopic).toHaveBeenCalledWith(
        Topics.WORKSPACE_INVITATION,
        'Invitation',
        {
          invites: ['user1@example.com', 'user2@example.com'],
          workspaceName: 'Test Workspace',
        },
      );
    });

    it('should throw an error if user does not have invite authority', async () => {
      // Mock userHasInviteAuthority to return null
      (service.userHasInviteAuthority as jest.Mock).mockResolvedValue(null);

      await expect(
        service.inviteMembers(workspaceId, userId, invites),
      ).rejects.toThrow('User does not have authority to invite members');
    });

    it('should throw an error if no valid email addresses are provided', async () => {
      // Mock userHasInviteAuthority to return workspace data
      (service.userHasInviteAuthority as jest.Mock).mockResolvedValue({
        id: workspaceId,
        name: 'Test Workspace',
      });

      // Mock database to return no users
      (databaseService.user.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.inviteMembers(workspaceId, userId, invites),
      ).rejects.toThrow(
        `No valid email addresses found: ${invites.join(', ')}`,
      );
    });

    it('should skip users who are already members', async () => {
      // Mock userHasInviteAuthority to return workspace data
      (service.userHasInviteAuthority as jest.Mock).mockResolvedValue({
        id: workspaceId,
        name: 'Test Workspace',
      });

      // Mock database responses
      (databaseService.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-456', email: 'user1@example.com' },
        { id: 'user-789', email: 'user2@example.com' },
      ]);
      (databaseService.member.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-456' },
      ]);
      (databaseService.invite.findFirst as jest.Mock).mockResolvedValue(null);
      (databaseService.invite.create as jest.Mock).mockResolvedValue({});
      (kafkaService.sendMessageToTopic as jest.Mock).mockResolvedValue(true);

      const result = await service.inviteMembers(workspaceId, userId, invites);

      expect(result).toEqual({ success: true });
      expect(databaseService.invite.create).toHaveBeenCalledTimes(1); // Only one user is invited
      expect(kafkaService.sendMessageToTopic).toHaveBeenCalledWith(
        Topics.WORKSPACE_INVITATION,
        'Invitation',
        {
          invites: ['user2@example.com'], // Only the non-member user is included
          workspaceName: 'Test Workspace',
        },
      );
    });

    it('should throw an error if Kafka message sending fails', async () => {
      // Mock userHasInviteAuthority to return workspace data
      (service.userHasInviteAuthority as jest.Mock).mockResolvedValue({
        id: workspaceId,
        name: 'Test Workspace',
      });

      // Mock database responses
      (databaseService.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-456', email: 'user1@example.com' },
      ]);
      (databaseService.member.findMany as jest.Mock).mockResolvedValue([]);
      (databaseService.invite.findFirst as jest.Mock).mockResolvedValue(null);
      (databaseService.invite.create as jest.Mock).mockResolvedValue({});
      (kafkaService.sendMessageToTopic as jest.Mock).mockRejectedValue(
        new Error('Kafka error'),
      );

      await expect(
        service.inviteMembers(workspaceId, userId, invites),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
