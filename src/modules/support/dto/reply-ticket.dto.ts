import { IsString, MaxLength } from 'class-validator';

export class ReplyTicketDto {
  @IsString()
  @MaxLength(5000)
  response: string;
}
