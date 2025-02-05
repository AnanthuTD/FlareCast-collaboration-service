import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceDto } from './create-workspace.dto';
import { Prisma } from '@prisma/client';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  id: string;
  updateWorkspaceDto: Prisma.WorkSpaceUpdateInput;
}
