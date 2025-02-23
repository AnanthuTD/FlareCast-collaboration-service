import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ChatsService } from './chats.service';
import { CreateChatWebsocketDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { DatabaseService } from 'src/database/database.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { BaseGateway } from 'src/common/base.gateway';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'chats',
})
export class ChatsGateway extends BaseGateway {
  private readonly logger = new Logger(ChatsGateway.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly kafkaService: KafkaService,
    private readonly chatsService: ChatsService,
  ) {
    super();
  }

  getRoomId(videoId: string): string {
    return `video-${videoId}`;
  }

  @SubscribeMessage('joinSpace')
  async handleJoinSpace(
    @MessageBody('videoId') videoId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.user.id;
      socket.join(this.getRoomId(videoId));
      this.logger.log(`User ${userId} joined space ${videoId}`);
    } catch (error) {
      this.logger.error('Error joining space', error);
      socket.emit('error', { message: 'Failed to join space' });
    }
  }

  @SubscribeMessage('leaveSpace')
  async handleLeaveSpace(
    @MessageBody('videoId') videoId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.user.id;
      socket.leave(this.getRoomId(videoId));
      this.logger.log(`User ${userId} left space ${videoId}`);
    } catch (error) {
      this.logger.error('Error leaving space', error);
      socket.emit('error', { message: 'Failed to leave space' });
    }
  }

  @SubscribeMessage('createChat')
  async create(
    @MessageBody() createChatDto: CreateChatWebsocketDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const userId = socket.data.user.id;
      const { videoId, tempId } = createChatDto;

      this.logger.debug(`Creating chat for video: ${videoId}`);

      const chat = await this.chatsService.create({
        ...createChatDto,
        userId,
      });

      this.server
        .to(this.getRoomId(videoId))
        .emit('newMessage', { ...chat, tempId });
      this.logger.log(`Message sent to space ${videoId}`);
    } catch (error) {
      this.logger.error('Error creating chat', error);
      socket.emit('error', { message: 'Failed to create chat' });
    }
  }

  @SubscribeMessage('findAllChats')
  async findAll(
    @MessageBody()
    data: {
      cursor: Date | null;
      videoId: string;
      limit: number;
    },
  ) {
    try {
      return await this.chatsService.findAll(data);
    } catch (error) {
      this.logger.error('Error fetching chats', error);
      return { message: 'Failed to fetch chats' };
    }
  }

  @SubscribeMessage('findOneChat')
  async findOne(@MessageBody() id: string) {
    try {
      return await this.chatsService.findOne(id);
    } catch (error) {
      this.logger.error(`Error fetching chat with id ${id}`, error);
      return { message: 'Failed to fetch chat' };
    }
  }

  @SubscribeMessage('updateChat')
  async update(@MessageBody() updateChatDto: UpdateChatDto) {
    try {
      const updatedChat = await this.chatsService.update(
        updateChatDto.id,
        updateChatDto,
      );
      this.server
        .to(this.getRoomId(updatedChat.videoId))
        .emit('updatedChat', updatedChat);
    } catch (error) {
      this.logger.error(
        `Error updating chat with id ${updateChatDto.id}`,
        error,
      );
      return { message: 'Failed to update chat' };
    }
  }

  @SubscribeMessage('removeChat')
  async remove(@MessageBody() id: string) {
    try {
      const removedChat = await this.chatsService.remove(id);
      this.server
        .to(this.getRoomId(removedChat.videoId))
        .emit('removedChat', removedChat);
    } catch (error) {
      this.logger.error(`Error removing chat with id ${id}`, error);
      return { message: 'Failed to remove chat' };
    }
  }
}
