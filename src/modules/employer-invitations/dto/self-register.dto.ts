import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body for the public self-registration endpoint (Method 3).
 * No invitation token is required — anyone can post this.
 */
export class SelfRegisterEmployerDto {
  // Employer identification
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() taxId: string;

  // Address
  @IsString() @IsNotEmpty() address: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() streetNumber?: string;
  @IsOptional() @IsString() floorDoor?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() latitude?: number | null;
  @IsOptional() longitude?: number | null;

  // Contact
  @IsOptional() @IsString() phone?: string;
  @IsString() @IsNotEmpty() mobile: string;
  @IsOptional() @IsString() landline?: string;

  // Plan
  @IsInt() typeId: number;
  @IsInt() subTypeId: number;

  // Trial — capped server-side regardless of input.
  @IsInt() @Min(0) @Max(15) trialDays: number;

  // User account
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() responsible?: string;

  // Honeypot — bots typically fill every field. Real users leave this blank.
  // If the field arrives populated, the request is silently rejected.
  @IsOptional() @IsString() website?: string;
}
