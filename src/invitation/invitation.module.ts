import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { CommonModule } from 'src/common/common.module';
import { KafkaModule } from 'src/kafka/kafka.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [InvitationController],
  providers: [InvitationService],
  imports: [CommonModule, KafkaModule, DatabaseModule],
})
export class InvitationModule {}
