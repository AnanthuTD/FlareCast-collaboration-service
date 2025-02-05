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
import { FolderService } from './folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { User, UserType } from 'src/common/decorators/user.decorator';
import { RenameFolderDto } from './dto/rename-folder.dto';

@Controller('folder')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get(':workspaceId')
  findFolders(
    @Param('workspaceId') workspaceId: string,
    @User() user: UserType,
    @Query('folderId') parentFolderId: string,
  ) {
    return this.folderService.findFolders(workspaceId, user.id, parentFolderId);
  }

  @Post(':workspaceId')
  createFolder(
    @Param('workspaceId') workspaceId: string,
    @Body() createFolderDto: CreateFolderDto,
    @User() user: UserType,
  ) {
    return this.folderService.createFolder(
      workspaceId,
      user.id,
      createFolderDto.folderId,
    );
  }

  @Delete(':workspaceId/:folderId')
  deleteFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @User() user: UserType,
  ) {
    return this.folderService.deleteFolder(workspaceId, user.id, folderId);
  }

  @Patch(':workspaceId/:folderId')
  renameFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @Body() renameFolderDto: RenameFolderDto,
    @User() user: UserType,
  ) {
    return this.folderService.renameFolder(
      workspaceId,
      user.id,
      folderId,
      renameFolderDto.name,
    );
  }

  @Get(':workspaceId/:folderId/parents')
  getParentFolders(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @User() user: UserType,
  ) {
    return this.folderService.getParentFolders(workspaceId, user.id, folderId);
  }
}
