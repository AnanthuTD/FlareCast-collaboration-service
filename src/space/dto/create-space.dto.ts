import { IsString, IsEnum, IsArray, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { SpaceType } from '@prisma/client';

export class CreateSpaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Name should not be empty' })
  name: string;

  @IsEnum(SpaceType, { message: 'Invalid space type' })
  type: SpaceType;

  @IsString()
  @IsNotEmpty({ message: 'Workspace ID is required' })
  workspaceId: string;

  @IsArray({ message: 'Members should be an array' })
  @IsString({ each: true, message: 'Each member must be a string' })
  @Type(() => String)
  members: string[];
}
