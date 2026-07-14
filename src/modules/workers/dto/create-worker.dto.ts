import { IsString, IsEmail, IsNotEmpty, IsOptional, IsDateString, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { normalizeFloorDoor } from '../../../common/utils/normalize-floor-door';

export class CreateWorkerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => normalizeFloorDoor(value))
  floorDoor?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

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
  sex?: string;

  @IsString()
  @IsOptional()
  gender?: string; // gender id as string

  @IsDateString()
  @IsOptional()
  birthday?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsString()
  @IsOptional()
  observation?: string;

  @IsString()
  @IsOptional()
  accessAccountStatus?: 'postpone' | 'request';

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEmail()
  @IsOptional()
  accessEmail?: string;

  @IsString()
  @IsOptional()
  bankIban?: string;

  @IsString()
  @IsOptional()
  bankSwift?: string;

  @IsString()
  @IsOptional()
  bankHolder?: string;
}
