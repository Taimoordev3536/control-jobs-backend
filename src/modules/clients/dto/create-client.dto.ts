import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeFloorDoor } from '../../../common/utils/normalize-floor-door';

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

  @IsString()
  employerId: string;

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

  // Summer period start/end (DD/MM). Mirrors SeasonalSchedule.startDate/endDate
  // naming so the same logic from the job side can be reused unchanged.
  @IsString()
  @IsOptional()
  summerStartDate?: string;

  @IsString()
  @IsOptional()
  summerEndDate?: string;

  @IsString()
  @IsOptional()
  accessAccountStatus?: 'postpone' | 'request'; // ✅ New field
  
  @IsEmail()
  @IsOptional()
  accessEmail?: string;

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
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
