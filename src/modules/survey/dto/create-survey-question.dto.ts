import { IsString, IsEnum, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { SurveyQuestionType } from '../entities/survey-question.entity';

export class CreateSurveyQuestionDto {
  @IsString()
  questionText: string;

  @IsEnum(SurveyQuestionType)
  questionType: SurveyQuestionType;

  @IsString()
  @IsOptional()
  options?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsInt()
  @IsOptional()
  order?: number;
} 