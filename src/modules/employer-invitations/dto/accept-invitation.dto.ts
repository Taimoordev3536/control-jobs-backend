import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Body for POST /api/employer-invitations/accept.
 * Mirrors the fields collected by the 3-step employer signup form,
 * plus the JWT token and a chosen password.
 */
export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;

  // ---- Employer form fields ----
  @IsString() name: string;
  @IsString() taxId: string;

  @IsString() address: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() streetNumber?: string;
  @IsOptional() @IsString() floorDoor?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() latitude?: number | null;
  @IsOptional() longitude?: number | null;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() landline?: string;

  @IsInt() typeId: number;
  @IsInt() subTypeId: number;
  @IsOptional() fee?: number;
  @IsOptional() discount?: number;

  @IsOptional() @IsInt() paymentMethodId?: number;
  @IsOptional() @IsString() accountIban?: string;
  @IsOptional() @IsString() bicSwift?: string;
  @IsOptional() @IsString() responsible?: string;

  @IsEmail() email: string;
}
