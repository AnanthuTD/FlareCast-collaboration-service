import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceModule } from './workspace/workspace.module';
import { DatabaseModule } from './database/database.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [WorkspaceModule, DatabaseModule, KafkaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
