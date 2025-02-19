import { Module } from '@nestjs/common';
import { FolderService } from './folder.service';
import { FolderController } from './folder.controller';
import { DatabaseModule } from 'src/database/database.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [FolderController],
  providers: [FolderService],
  imports: [DatabaseModule, KafkaModule, CommonModule],
  exports: [FolderService],
})
export class FolderModule {}
