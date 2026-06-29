import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateAdminConfigDto {
  @IsString()
  companyName: string;

  @IsString()
  address: string;

  @IsNumber()
  vatRate: number;

  @IsString()
  invoiceSeries: string;

  @IsString()
  paymentDetails: string;

  @IsOptional()
  @IsString()
  ivaTextParticularesTai?: string;

  @IsOptional()
  @IsString()
  ivaTextAutonomosFueraTai?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  swiftBic?: string;

  @IsOptional()
  @IsString()
  paypal?: string;
}
