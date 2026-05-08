import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Body for PATCH /api/worker-invitations/:publicId.
 *
 * Only safe-to-mutate fields after the link has been shared.
 */
export class UpdateWorkerInvitationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
