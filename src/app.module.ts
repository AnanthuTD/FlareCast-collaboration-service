import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceModule } from './workspace/workspace.module';
import { DatabaseModule } from './database/database.module';
import { KafkaModule } from './kafka/kafka.module';
import { JwtMiddleware } from './jwt.middleware';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    WorkspaceModule,
    DatabaseModule,
    KafkaModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info', // Adjust log level (e.g., 'debug', 'info', 'warn', 'error')
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true, // Colorize output for better readability in development
            translateTime: true, // Add timestamps in logs
            ignore: 'pid,hostname', // Exclude specific fields
          },
        },
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              // Exclude sensitive or excessive data from request logs
            };
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
