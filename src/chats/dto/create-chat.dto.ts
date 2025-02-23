import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatWebsocketDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsNotEmpty()
  @IsString()
  videoId: string;

  // @IsString()
  repliedTo?: any;
  tempId?: string;
}

export class CreateChatDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  videoId: string;

  // @IsString()
  repliedTo?: any;
}
