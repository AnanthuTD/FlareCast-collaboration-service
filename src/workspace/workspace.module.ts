import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { DatabaseModule } from 'src/database/database.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  imports: [DatabaseModule, KafkaModule, CommonModule],
})
export class WorkspaceModule {}
