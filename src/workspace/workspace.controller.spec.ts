import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { UserType } from 'src/decorators/user.decorator';
import { DatabaseService } from 'src/database/database.service';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let workspaceService: WorkspaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            inviteMembers: jest.fn(),
          },
        },
      ],
      imports: [DatabaseService],
    }).compile();

    controller = module.get<WorkspaceController>(WorkspaceController);
    workspaceService = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('inviteMembers', () => {
    it('should call workspaceService.inviteMembers with correct parameters', async () => {
      const workspaceId = 'workspace-123';
      const user: UserType = { id: 'user-123' };
      const invites = ['user-456', 'user-789'];

      const result = { success: true };
      jest.spyOn(workspaceService, 'inviteMembers').mockResolvedValue(result);

      const response = await controller.inviteMembers(
        workspaceId,
        user,
        invites,
      );

      expect(workspaceService.inviteMembers).toHaveBeenCalledWith(
        workspaceId,
        user.id,
        invites,
      );
      expect(response).toEqual(result);
    });
  });
});
