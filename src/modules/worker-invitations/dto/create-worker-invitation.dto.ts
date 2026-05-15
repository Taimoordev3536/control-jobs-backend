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
 * Body for POST /api/worker-invitations.
 *
 * Issued by an authenticated employer; recipients use the resulting
 * shareable link to self-register as workers under that employer.
 */
export class CreateWorkerInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  occupation: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
