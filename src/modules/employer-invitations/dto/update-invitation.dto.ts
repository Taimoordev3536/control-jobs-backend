import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for PATCH /api/employer-invitations/:publicId.
 *
 * Only fields that are safe to mutate after the link has been shared:
 *   - description, discountPercent (DB is the source of truth at accept-time)
 *   - expiresAt (re-signed token uses the new expiry)
 *
 * partnerId / trialDays are intentionally NOT editable — the JWT already
 * shipped to recipients encodes them, and the accept flow rejects mismatches.
 */
export class UpdateInvitationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
