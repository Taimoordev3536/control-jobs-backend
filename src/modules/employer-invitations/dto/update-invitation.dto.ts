import {
  IsDateString,
  IsInt,
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
 * Editable fields. DB is the source of truth at accept-time for
 * description, discountPercent, and trialDays — so changes here apply
 * to every future redemption, including via links already shared.
 *
 * partnerId is intentionally NOT editable.
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
  @IsInt()
  @Min(0)
  @Max(30)
  trialDays?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
