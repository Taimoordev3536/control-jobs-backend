import { IsString, MaxLength } from 'class-validator';

export class CreateSuggestionDto {
  @IsString()
  @MaxLength(5000)
  message: string;
}
