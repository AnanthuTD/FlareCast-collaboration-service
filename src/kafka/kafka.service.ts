import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, Producer } from 'kafkajs';
import { logger } from 'src/logger/logger';

export enum Topics {
  WORKSPACE_INVITATION = 'workspace-invitation',
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
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

    this.consumer = this.kafka.consumer({ groupId: 'collaboration-group' });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.producer.connect();
    logger.info('Kafka consumer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }

  async subscribeToTopic(
    topic: string,
    onMessage: (message: any) => Promise<void>,
  ) {
    await this.consumer.subscribe({ topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const { key, value } = message;

        if (value) {
          await onMessage({
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
