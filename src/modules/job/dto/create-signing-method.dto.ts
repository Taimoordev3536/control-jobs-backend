import { IsEnum, IsArray, IsBoolean } from 'class-validator';
import { SigningMethodType, SigningMethodDetail } from '../entities/signing-method.entity';

export class CreateSigningMethodDto {
  @IsEnum(SigningMethodType)
  methodType: SigningMethodType;

  @IsArray()
  @IsEnum(SigningMethodDetail, { each: true })
  methodDetails: SigningMethodDetail[];

  @IsBoolean()
  verifyIdentity: boolean;
} 