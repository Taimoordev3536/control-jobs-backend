import {
  IsEmail,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsInt()
  @Min(0)
  @Max(30)
  trialDays: number;

  // Required for admin role; ignored (overridden) for partner role.
  @IsOptional()
  @IsInt()
  partnerId?: number;
}
