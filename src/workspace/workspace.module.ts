import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  imports: [DatabaseModule],
})
export class WorkspaceModule {}
