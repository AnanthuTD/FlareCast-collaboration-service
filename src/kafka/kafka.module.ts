import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [KafkaService, KafkaConsumerService],
  exports: [KafkaService],
  imports: [DatabaseModule],
})
export class KafkaModule {}
