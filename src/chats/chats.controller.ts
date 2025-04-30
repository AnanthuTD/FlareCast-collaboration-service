import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  /**
   * Fetch chats.
   */
  @Get(':videoId')
  async getChats(
    @Param('videoId') videoId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '10',
  ) {
    return this.chatsService.findAll({
      videoId,
      cursor: cursor ? cursor : null,
      limit: parseInt(limit),
    });
  }
}
