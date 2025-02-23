import { Module } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { ChatsController } from './chats.controller';
import { DatabaseModule } from 'src/database/database.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [ChatsController],
  providers: [ChatsGateway, ChatsService, ChatsGateway],
  imports: [DatabaseModule, KafkaModule, CommonModule],
})
export class ChatsModule {}
