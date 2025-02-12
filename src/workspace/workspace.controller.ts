import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { User, UserType } from 'src/common/decorators/user.decorator';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { Member } from '@prisma/client';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  create(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @User() user: UserType,
  ) {
    return this.workspaceService.create({
      ...createWorkspaceDto,
      userId: user.id,
    });
  }

  @Get()
  findByUserId(@User() user: UserType) {
    return this.workspaceService.findByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workspaceService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto['updateWorkspaceDto'],
  ) {
    return this.workspaceService.update({ id, updateWorkspaceDto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workspaceService.remove(id);
  }

  @Get(':workspaceId/members')
  getWorkspaceMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspaceService.getWorkspaceMembers(workspaceId);
  }

  @Patch(':workspaceId/member/:memberId')
  updateRole(
    @User() user: UserType,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: Member['role'],
  ) {
    return this.workspaceService.updateRole(
      user.id,
      workspaceId,
      role,
      memberId,
    );
  }

  @Delete(':workspaceId/member/:memberId')
  removeMember(
    @User() user: UserType,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.workspaceService.removeMember(workspaceId, user.id, memberId);
  }

  // requested only by the video service
  @Get(':userId/selected')
  getSelectedWorkspace(
    @Param('userId') userId: string,
    @Query('workspaceId') workspaceId: string,
    @Query('folderId') folderId: string,
  ) {
    return this.workspaceService.getSelectedWorkspace(
      userId,
      workspaceId,
      folderId,
    );
  }

  @Get(':workspaceId/search')
  async searchMembers(
    @Param('workspaceId') workspaceId: string,
    @Query('q') query: string = '',
    @Query('spaceId') spaceId: string = '',
    @User() user: UserType,
  ) {
    return this.workspaceService.searchMembers(
      workspaceId,
      spaceId,
      query,
      user.id,
    );
  }
}
