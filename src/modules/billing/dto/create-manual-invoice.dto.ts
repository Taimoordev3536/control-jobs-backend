import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceType } from '../entities/invoice.entity';

export class ManualInvoiceLineDto {
  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateManualInvoiceDto {
  @IsNumber()
  employerId: number;

  @IsOptional()
  @IsEnum(['NORMAL', 'RECTIFICATIVA'])
  invoiceType?: InvoiceType;

  // Required when invoiceType is RECTIFICATIVA — the original being corrected.
  @IsOptional()
  @IsNumber()
  rectifiesInvoiceId?: number;

  // ISO date (yyyy-mm-dd); defaults to today.
  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  periodStart?: string;

  @IsOptional()
  @IsString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  chargeDate?: string;

  @IsOptional()
  @IsNumber()
  paymentMethodId?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPct?: number;

  // Defaults to AdminConfig.vatRate when omitted.
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatPct?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualInvoiceLineDto)
  lines: ManualInvoiceLineDto[];
}
