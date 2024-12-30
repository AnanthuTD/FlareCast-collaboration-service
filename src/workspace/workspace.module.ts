import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { DatabaseModule } from 'src/database/database.module';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  imports: [DatabaseModule, KafkaModule],
})
export class WorkspaceModule {}
