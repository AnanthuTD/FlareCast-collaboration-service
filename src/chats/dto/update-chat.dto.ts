import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateChatDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  message: string;
}
