import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SourceDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  folderId?: string;
}

class DestinationDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  folderId?: string;
}

export class GetPermissionDto {
  @IsString()
  userId: string;

  @ValidateNested()
  @Type(() => SourceDto)
  source: SourceDto;

  @ValidateNested()
  @Type(() => DestinationDto)
  destination: DestinationDto;
}
