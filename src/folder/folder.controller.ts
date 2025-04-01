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

@Controller('folder')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get(':workspaceId/search')
  async searchFolders(
    @Query('query') query: string,
    @User() user: UserType,
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit = '10',
    @Query('paginationToken') paginationToken?: string,
  ) {
    return this.folderService.searchFolder({
      workspaceId,
      query,
      userId: user.id,
      limit,
      paginationToken,
    });
  }

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
    return this.folderService.findFolders({
      workspaceId,
      userId: user.id,
      folderId: parentFolderId,
      spaceId,
    });
  }

  /**
   * Create a new folder.
   * Only Admins and Editors can create folders.
   */
  @Post(':workspaceId')
  async createFolder(
    @Param('workspaceId') workspaceId: string,
    @Body() createFolderDto: CreateFolderDto,
    @User() user: UserType,
  ) {
    return this.folderService.createFolder({
      workspaceId,
      userId: user.id,
      folderId: createFolderDto.folderId,
      spaceId: createFolderDto.spaceId,
    });
  }

  /**
   * Delete a folder by ID.
   * Only Admins can delete folders.
   */
  @Delete(':folderId')
  // @Roles('admin')
  async deleteFolder(
    @Param('folderId') folderId: string,
    @User() user: UserType,
  ) {
    return this.folderService.deleteFolder({
      userId: user.id,
      folderId,
    });
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

  /**
   * Get movable folders in workspaces or a folder.
   */
  @Patch(':folderId/move')
  async getMovableFolders(
    @Param('folderId') folderId: string,
    @User() user: UserType,
    @Body() destination: { id: string; type: 'folder' | 'workspace' | 'space' },
  ) {
    return this.folderService.moveFolder(user.id, folderId, destination);
  }

  /**
   * Rename a folder.
   * Only Admins and Editors can rename folders.
   */
  @Patch('/:folderId/rename')
  async renameFolder(
    @Param('folderId') folderId: string,
    @Body() renameFolderDto: RenameFolderDto,
    @User() user: UserType,
  ) {
    return this.folderService.renameFolder({
      userId: user.id,
      folderId,
      newName: renameFolderDto.name,
    });
  }
}
