import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SpaceService } from './space.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { User, UserType } from 'src/common/decorators/user.decorator';

@Controller('space')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Post('/:spaceId/member')
  async addMemberToSpace(
    @Param('spaceId') spaceId: string,
    @User() user: UserType,
    @Body('memberId') memberId: string,
  ) {
    return await this.spaceService.addMemberToSpace(spaceId, user.id, memberId);
  }

  @Delete('/:spaceId/member/:memberId')
  async removeMemberFromSpace(
    @Param('spaceId') spaceId: string,
    @Param('memberId') memberId: string,
    @User() user: UserType,
  ) {
    return await this.spaceService.removeMemberFromSpace(
      spaceId,
      user.id,
      memberId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSpaceDto: CreateSpaceDto, @User() user: UserType) {
    return await this.spaceService.create(createSpaceDto, user.id);
  }

  @Get('workspace/:workspaceId')
  async findAll(@Param('workspaceId') workspaceId: string) {
    return await this.spaceService.findAll(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.spaceService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSpaceDto: UpdateSpaceDto,
  ) {
    return await this.spaceService.update(id, updateSpaceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.spaceService.remove(id);
  }

  @Get(':spaceId/members')
  async getSpaceMembers(@Param('spaceId') spaceId: string) {
    return await this.spaceService.getSpaceMembers(spaceId);
  }
}
