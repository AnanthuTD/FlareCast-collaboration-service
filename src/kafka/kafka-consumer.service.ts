import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaService, Topics } from './kafka.service';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit() {
    await this.kafkaService.subscribeToTopic(
      Topics.USER_SUBSCRIPTION_UPDATED,
      async (
        topic,
        {
          value,
        }: {
          value: { userId: string; maxMembers: number; maxWorkspaces: number };
        },
      ) => {
        console.log(`New ${Topics.USER_SUBSCRIPTION_UPDATED} received}`, value);
        await this.databaseService.user.update({
          where: { id: value.userId },
          data: {
            maxMembers: value.maxMembers,
            maxWorkspaces: value.maxWorkspaces,
          },
        });
      },
    );
  }
}
