import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Kafka, Consumer, Producer } from 'kafkajs';

export enum Topics {
  NOTIFICATION_EVENT = 'notification-event',
  INVITATION_STATUS_UPDATE = 'collaboration.invitation.update',
  USER_SUBSCRIPTION_UPDATED = 'user.subscription.updated',
  USER_VERIFIED_EVENT = 'user-events',
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private messageHandlers: Map<
    string,
    (topic: string, message: any) => Promise<void>
  > = new Map();
  private isConsumerRunning = false;

  private readonly consumerGroupId: string =
    process.env.KAFKA_CONSUMER_GROUP || 'collaboration-group';
  private readonly fromBeginning: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'collaboration-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      // Uncomment if using SASL
      /* sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      }, */
    });

    this.consumer = this.kafka.consumer({
      groupId: this.consumerGroupId,
      allowAutoTopicCreation: true,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    const admin = this.kafka.admin();
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const topicsToCreate = [
      { topic: Topics.INVITATION_STATUS_UPDATE, numPartitions: 1 },
      { topic: Topics.NOTIFICATION_EVENT, numPartitions: 1 },
      { topic: Topics.USER_SUBSCRIPTION_UPDATED, numPartitions: 1 },
      { topic: Topics.USER_VERIFIED_EVENT, numPartitions: 1 },
    ].filter((t) => !existingTopics.includes(t.topic));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({ topics: topicsToCreate });
      this.logger.log(
        `Created topics: ${topicsToCreate.map((t) => t.topic).join(', ')}`,
      );
    }
    await admin.disconnect();

    await this.consumer.connect();
    await this.producer.connect();
    this.logger.log('Kafka consumer and producer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    this.logger.log('Kafka consumer and producer disconnected');
  }

  async subscribeToTopic<T>(
    topic: string,
    onMessage: (
      topic: string,
      message: { key: string | null; value: T },
    ) => Promise<void>,
  ) {
    this.messageHandlers.set(topic, onMessage as any);

    if (this.isConsumerRunning) {
      await this.consumer.stop(); // Stop the consumer to resubscribe
      this.isConsumerRunning = false;
    }

    const topics = Array.from(this.messageHandlers.keys());
    await this.consumer.subscribe({
      topics,
      fromBeginning: this.fromBeginning,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const handler = this.messageHandlers.get(topic);
          if (handler && message.value) {
            const parsedMessage = JSON.parse(message.value.toString());
            await handler(topic, {
              key: message.key?.toString() || null,
              value: parsedMessage,
            });
          }
        } catch (error) {
          this.logger.error(
            `Error processing message from topic ${topic}: ${error.message}`,
            error.stack,
          );
        }
      },
    });
    this.isConsumerRunning = true;
    this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
  }

  async sendMessageToTopic<T>(topic: Topics, key: string, value: T) {
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(value), key }],
      });
      this.logger.debug(`Message sent to topic ${topic} with key ${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${topic}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
