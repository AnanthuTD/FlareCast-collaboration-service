import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  // UseGuards,
} from '@nestjs/common';
import { FolderService } from './folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';
import { User, UserType } from 'src/common/decorators/user.decorator';
// import { Roles } from 'src/common/decorators/roles.decorator';
// import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('folder')
// @UseGuards(RolesGuard) // Applies role-based access control
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  /**
   * Fetch all folders for a workspace.
   */
  @Get(':workspaceId')
  async findFolders(
    @Param('workspaceId') workspaceId: string,
    @User() user: UserType,
    @Query('folderId') parentFolderId?: string,
    @Query('spaceId') spaceId?: string,
  ) {
    return this.folderService.findFolders(
      workspaceId,
      user.id,
      parentFolderId,
      spaceId,
    );
  }

  /**
   * Create a new folder.
   * Only Admins and Editors can create folders.
   */
  @Post(':workspaceId')
  // @Roles('admin', 'editor')
  async createFolder(
    @Param('workspaceId') workspaceId: string,
    @Body() createFolderDto: CreateFolderDto,
    @User() user: UserType,
  ) {
    return this.folderService.createFolder(
      workspaceId,
      user.id,
      createFolderDto.folderId,
      createFolderDto.spaceId,
    );
  }

  /**
   * Delete a folder by ID.
   * Only Admins can delete folders.
   */
  @Delete(':workspaceId/:folderId')
  // @Roles('admin')
  async deleteFolder(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @User() user: UserType,
    @Query('spaceId') spaceId?: string,
  ) {
    return this.folderService.deleteFolder(
      workspaceId,
      user.id,
      folderId,
      spaceId,
    );
  }

  /**
   * Rename a folder.
   * Only Admins and Editors can rename folders.
   */
  @Patch(':workspaceId/:folderId')
  // @Roles('admin', 'editor')
  async renameFolder(
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

  /**
   * Get parent folders of a given folder.
   */
  @Get(':workspaceId/:folderId/parents')
  async getParentFolders(
    @Param('workspaceId') workspaceId: string,
    @Param('folderId') folderId: string,
    @User() user: UserType,
  ) {
    return this.folderService.getParentFolders(workspaceId, user.id, folderId);
  }
}
