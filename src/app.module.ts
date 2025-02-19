import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceModule } from './workspace/workspace.module';
import { DatabaseModule } from './database/database.module';
import { KafkaModule } from './kafka/kafka.module';
import { JwtMiddleware } from './jwt.middleware';
import { LoggerModule } from 'nestjs-pino';
import { LokiOptions } from 'pino-loki';
import { FolderModule } from './folder/folder.module';
import { InvitationModule } from './invitation/invitation.module';
import { SpaceModule } from './space/space.module';
import { FolderService } from './folder/folder.service';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    WorkspaceModule,
    DatabaseModule,
    KafkaModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'debug',
        transport: {
          targets: [
            {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: true,
                ignore: 'pid,hostname',
              },
            },
            {
              target: 'pino-loki',
              options: {
                batching: true,
                interval: 5,
                host: process.env.GRAFANA_HOST || 'http://localhost:3100',
                basicAuth: {
                  username: process.env.LOKI_USER_ID || '',
                  password: process.env.LOKI_API_KEY || '',
                },
                labels: { app: 'collaboration-service' },
              } as LokiOptions,
            },
          ],
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
    FolderModule,
    InvitationModule,
    SpaceModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService, FolderService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware)
      .exclude(
        { path: 'invitation/accept', method: RequestMethod.POST },
        { path: '/permissions/share-file', method: RequestMethod.POST },
        { path: '/', method: RequestMethod.GET },
        { path: 'workspace/selected', method: RequestMethod.POST },
        { path: 'workspace/:userId/selected', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
