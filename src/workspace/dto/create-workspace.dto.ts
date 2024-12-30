import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

enum WorkspaceType {
  PERSONAL,
  PUBLIC,
}

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(WorkspaceType)
  type: WorkspaceType;

  @IsArray()
  @IsOptional()
  memberIds?: string[];

  @IsArray()
  @IsOptional()
  inviteIds?: string[];
}
