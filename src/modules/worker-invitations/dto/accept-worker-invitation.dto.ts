import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for POST /api/worker-invitations/accept.
 *
 * Mirrors CreateWorkerDto's recipient-fillable fields plus token + password.
 */
export class AcceptWorkerInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  code?: string;

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
  nif: string;

  @IsString()
  @IsOptional()
  naf?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsDateString()
  @IsNotEmpty()
  birthday: string;
}
