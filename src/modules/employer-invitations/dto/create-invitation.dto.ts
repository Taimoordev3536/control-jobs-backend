import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for POST /api/employer-invitations.
 *
 * Bulk-link semantics: one invitation row → many redemptions. The
 * recipient's email is no longer captured here; the admin/partner
 * shares the link and any unauthenticated visitor can redeem.
 */
export class CreateInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  // Required for admin role; ignored (overridden) for partner role.
  @IsOptional()
  @IsInt()
  partnerId?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;

  @IsInt()
  @Min(0)
  @Max(30)
  trialDays: number;

  // Optional cap — null/undefined means unlimited until expiry.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  // Optional caducidad — null/undefined means no expiry.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
