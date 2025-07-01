import { IsString, IsNumber } from 'class-validator';

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
}
