import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for POST /api/client-invitations.
 *
 * Issued by an authenticated employer; recipients use the resulting
 * shareable link to self-register as clients (B2B customers) under
 * that employer.
 */
export class CreateClientInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
