import { Module } from '@nestjs/common';
import { SpaceService } from './space.service';
import { SpaceController } from './space.controller';
import { CommonModule } from 'src/common/common.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [SpaceController],
  providers: [SpaceService],
  imports: [DatabaseModule, KafkaModule, CommonModule],
})
export class SpaceModule {}
