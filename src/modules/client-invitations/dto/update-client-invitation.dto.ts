import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Body for PATCH /api/client-invitations/:publicId.
 */
export class UpdateClientInvitationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsIn(['company', 'particular'])
  type?: 'company' | 'particular';

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
