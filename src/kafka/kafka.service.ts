import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Kafka, Consumer, Producer } from 'kafkajs';

export enum Topics {
  WORKSPACE_INVITATION = 'workspace-invitation',
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'collaboration-service',
      brokers: [process.env.KAFKA_BROKER],
      /*   sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      }, */
    });

    this.consumer = this.kafka.consumer({
      groupId: 'collaboration-group',
      allowAutoTopicCreation: true,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.producer.connect();
    this.logger.log('Kafka consumer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected');
  }

  async subscribeToTopic(
    topic: string,
    onMessage: (topic: string, message: any) => Promise<void>,
  ) {
    await this.consumer.subscribe({ topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message, topic }) => {
        const { key, value } = message;

        if (value) {
          await onMessage(topic, {
            key: key?.toString(),
            value: JSON.parse(value.toString()),
          });
        }
      },
    });
  }

  async sendMessageToTopic(topic: Topics, key: string, value: any) {
    await this.producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(value),
          key,
        },
      ],
    });
  }
}
