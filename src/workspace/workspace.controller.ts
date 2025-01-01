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
// import { Request } from 'express';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  create(@Body() createWorkspaceDto: Prisma.WorkSpaceCreateInput) {
    return this.workspaceService.create(createWorkspaceDto);
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
}
