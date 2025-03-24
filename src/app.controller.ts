import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { GetPermissionDto } from './dto/share-file-permission.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('permissions/share-file')
  async getPermissionToShareFile(@Body() payload: GetPermissionDto) {
    return this.appService.getPermissionToShareFile(payload);
  }

  @Get('permissions/:spaceId/space/:userId/isMember')
  async isMember(@Param() params: { spaceId: string; userId: string }) {
    return this.appService.isMember(params.spaceId, params.userId);
  }
}
