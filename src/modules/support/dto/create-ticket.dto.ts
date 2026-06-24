import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MaxLength(5000)
  message: string;
}
