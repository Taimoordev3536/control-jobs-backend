import { IsString, IsOptional, IsEmail, IsNumber, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWorkCenterDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsOptional()
  locality?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  // contactEmail is optional. Empty string is coerced to null and validation is skipped
  // when the field is null/undefined, so the user can leave it blank or clear an existing
  // value without tripping @IsEmail().
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @ValidateIf((o) => o.contactEmail !== null && o.contactEmail !== undefined)
  @IsEmail()
  @IsOptional()
  contactEmail?: string | null;

  @IsString()
  @IsOptional()
  landline?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  observations?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsNumber()
  @IsOptional()
  employerId?: number;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @IsOptional()
  gpsRadius?: number;
}
