import { IsString, IsEmail, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateWorkerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  landline?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  nif?: string;

  @IsString()
  @IsOptional()
  naf?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  gender?: string; // gender id as string

  @IsDateString()
  @IsOptional()
  birthday?: string;

  @IsString()
  @IsOptional()
  accessAccountStatus?: 'postpone' | 'request';

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
