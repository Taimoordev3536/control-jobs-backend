import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateFaqDto {
  @IsString()
  @MaxLength(500)
  question: string;

  @IsString()
  @MaxLength(5000)
  answer: string;

  @IsOptional()
  @IsIn(['ALL', 'ADMIN', 'PARTNER', 'EMPLOYER', 'CLIENT', 'WORKER'])
  audience?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
