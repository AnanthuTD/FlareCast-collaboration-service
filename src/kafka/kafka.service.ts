import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

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
  }

  async onModuleInit() {
    await this.consumer.connect();
    console.log('Kafka consumer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    console.log('Kafka consumer disconnected');
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
}
