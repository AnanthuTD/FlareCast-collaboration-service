import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { Prisma } from '@prisma/client';
import { Request } from 'express';

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
}
