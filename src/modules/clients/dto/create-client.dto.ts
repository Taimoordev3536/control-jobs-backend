import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  status: string;

  @IsString()
  code: string;

  @IsString()
  taxId: string;

  @IsString()
  address: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsNumber()
  employerId: number;

  @IsString()
  landline: string;

  @IsString()
  mobile: string;

  @IsString()
  observation: string;

  @IsString()
  responsible: string;

  @IsString()
  winterSchedule: string;

  @IsString()
  summerSchedule: string;

  @IsString()
  @IsOptional()
  accessAccountStatus?: 'postpone' | 'request'; // ✅ New field
  
  @IsEmail()
  @IsOptional()
  accessEmail?: string;
}
