import { Module } from '@nestjs/common';
import { SpaceService } from './space.service';
import { SpaceController } from './space.controller';
import { CommonModule } from 'src/common/common.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { DatabaseModule } from 'src/database/database.module';
import { SpacesGateway } from './space.gateway';

@Module({
  controllers: [SpaceController],
  providers: [SpaceService, SpacesGateway],
  imports: [DatabaseModule, KafkaModule, CommonModule],
})
export class SpaceModule {}
