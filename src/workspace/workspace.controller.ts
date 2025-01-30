import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { Prisma } from '@prisma/client';
import { User, UserType } from 'src/decorators/user.decorator';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  create(
    @Body() createWorkspaceDto: { name: string; members: string[] },
    @User() user: UserType,
  ) {
    return this.workspaceService.create({
      ...createWorkspaceDto,
      userId: user.id,
    });
  }

  @Get()
  findByUserId(@Req() req: Request) {
    return this.workspaceService.findByUser(req['user'].id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workspaceService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWorkspaceDto: Prisma.WorkSpaceUpdateInput,
  ) {
    return this.workspaceService.update(id, updateWorkspaceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workspaceService.remove(id);
  }

  @Get(':workspaceId/folders')
  findFolders(
    @Param('workspaceId') workspaceId: string,
    @Query('folderId') parentFolderId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.findFolders(
      workspaceId,
      req['user'].id,
      parentFolderId,
    );
  }

  @Post(':workspaceId/folder')
  createFolder(
    @Param('workspaceId') workspaceId: string,
    @Body('folderId') parentFolderId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.createFolder(
      workspaceId,
      req['user'].id,
      parentFolderId,
    );
  }

  @Delete(':workspaceId/folder/:folderId')
  deleteFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.deleteFolder(
      workspaceId,
      req['user'].id,
      folderId,
    );
  }

  @Patch(':workspaceId/folder/:folderId')
  renameFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @Body() { name },
    @Req() req: Request,
  ) {
    return this.workspaceService.renameFolder(
      workspaceId,
      req['user'].id,
      folderId,
      name,
    );
  }

  @Get(':workspaceId/folder/:folderId/parents')
  getParentFolders(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.getParentFolders(
      workspaceId,
      req['user'].id,
      folderId,
    );
  }

  @Post(':workspaceId/invite')
  inviteMembers(
    @Param('workspaceId') workspaceId: string,
    @User() user: UserType,
    @Body('invites') invites: string[],
  ) {
    return this.workspaceService.inviteMembers(workspaceId, user.id, invites);
  }
}
