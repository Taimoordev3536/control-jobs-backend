import {
  IsString,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmployerUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // @IsString()
  // @IsNotEmpty()
  // password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}

export class CreateEmployerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  taxId: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @IsNotEmpty()
  partnerId: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  landline?: string;

  // REMOVED: email field from CreateEmployerDto
  // @IsEmail()
  // @IsNotEmpty()
  // email: string;

  @IsNumber()
  @IsNotEmpty()
  typeId: number;

  @IsNumber()
  @IsNotEmpty()
  subTypeId: number;

  @IsNumber()
  @IsNotEmpty()
  fee: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  @IsNotEmpty()
  paymentMethodId: number;

  @IsString()
  @IsOptional()
  accountIban?: string;

  @IsString()
  @IsOptional()
  bicSwift?: string;

  @IsString()
  @IsOptional()
  probationPeriod?: string;

  @IsString()
  @IsOptional()
  responsible?: string;

  @IsString()
  @IsOptional()
  accessAccountStatus?: 'postpone' | 'request';

  @IsEmail()
  @IsOptional()
  accessEmail?: string;

  @IsBoolean()
  @IsOptional()
  createUserAccount?: boolean;

  @ValidateNested()
  @Type(() => CreateEmployerUserDto)
  // MADE REQUIRED: If an employer is created, a user must be provided.
  // Or, you can add a validation rule that if createUserAccount is true, then user must be present.
  // For now, I'm assuming if you remove employer email, then a user email must be provided.
  @IsNotEmpty({
    message: 'User account details must be provided if creating an employer.',
  })
  user: CreateEmployerUserDto;
}
