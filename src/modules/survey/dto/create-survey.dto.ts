import { IsString, IsOptional, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSurveyDto {
  @IsString()
  @IsOptional()
  questionText?: string;

  @IsOptional()
  @IsInt()
  rateDigit?: number;

  @IsOptional()
  @IsString()
  textAlertTracking?: string;

  @IsOptional()
  @IsString()
  greetingText?: string;

  @IsOptional()
  @IsString()
  periodicity?: string; // daily|weekly|monthly

  @IsOptional()
  @IsInt()
  interval?: number;

  @IsOptional()
  @IsString()
  sendTime?: string; // HH:MM or HH:MM:SS

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  monthlyDays?: any[];

  @IsOptional()
  @IsArray()
  monthlyWeekdays?: any[];

  @IsOptional()
  @IsInt()
  monthlyStartWeekday?: number;

  @IsOptional()
  @IsInt()
  monthlyEndWeekday?: number;

  // questions are no longer accepted in the CreateSurvey DTO; questions are not stored on the survey row
} 