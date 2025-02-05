import { Module } from '@nestjs/common';
import { WorkspaceMemberService } from './workspace-member.service';
import { DatabaseModule } from 'src/database/database.module';
import { ValidationService } from './validations/validations.service';

@Module({
  providers: [WorkspaceMemberService, ValidationService],
  exports: [WorkspaceMemberService, ValidationService],
  imports: [DatabaseModule],
})
export class CommonModule {}
