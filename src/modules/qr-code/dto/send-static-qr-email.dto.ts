import { IsEmail, IsBoolean, IsOptional } from 'class-validator';

export class SendStaticQrEmailDto {
  @IsEmail()
  clientEmail: string;

  @IsBoolean()
  @IsOptional()
  includeInstructions?: boolean;
}
