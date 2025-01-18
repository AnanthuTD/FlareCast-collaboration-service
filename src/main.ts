import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { MicroserviceOptions, Transport } from '@nestjs/microservices';
declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  console.log('kafka broker', process.env.KAFKA_BROKER);

  // Kafka microservice
  /* app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER],
        sasl: {
          mechanism: 'plain',
          username: process.env.KAFKA_USERNAME,
          password: process.env.KAFKA_PASSWORD,
        },
      },
    },
  }); */

  // await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3001);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
