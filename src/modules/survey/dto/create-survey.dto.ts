import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSurveyQuestionDto } from './create-survey-question.dto';

export class CreateSurveyDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyQuestionDto)
  questions: CreateSurveyQuestionDto[];
} 