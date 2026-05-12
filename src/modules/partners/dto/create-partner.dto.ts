import {
  IsString,
  IsEmail,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const PARTNER_TYPE_ALIASES: Record<string, string> = {
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  AFFILIATE: 'Affiliate',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  affiliate: 'Affiliate',
};

const normalizePartnerType = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return PARTNER_TYPE_ALIASES[value] ?? value;
};

const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  TRANSFER: 'Transfer',
  Transfer: 'Transfer',
  transfer: 'Transfer',
  DIRECT_DEBIT: 'Direct Debit',
  'Direct Debit': 'Direct Debit',
  'direct debit': 'Direct Debit',
  Cash: 'Direct Debit',
  CASH: 'Direct Debit',
  CARD: 'Card',
  Card: 'Card',
  card: 'Card',
  PAYPAL: 'PayPal',
  PayPal: 'PayPal',
  paypal: 'PayPal',
  Paypal: 'PayPal',
  OTHERS: 'Others',
  Others: 'Others',
  others: 'Others',
};

const normalizePaymentMethod = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return PAYMENT_METHOD_ALIASES[value] ?? value;
};

export enum PartnerType {
  GOLD = "Gold",
  SILVER = "Silver",
  BRONZE = "Bronze",
  AFFILIATE = "Affiliate",
}


export enum PaymentMethodEnum {
  Transfer = 'Transfer',
  Cash = 'Direct Debit',
  Card = 'Card',
  Paypal = 'PayPal',
  Others = 'Others',
}

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsString()
  @IsOptional()
  floorDoor?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsString()
  @IsOptional()
  landline?: string; // ✅ New field

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  nif: string;

  @Transform(normalizePartnerType)
  @IsEnum(PartnerType)
  @IsNotEmpty()
  typeOfPartner: PartnerType;

  @IsNumber()
  @Min(0)
  @Max(100)
  commission: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  retention: number;

  @Transform(normalizePaymentMethod)
  @IsEnum(PaymentMethodEnum)
  @IsNotEmpty()
  paymentMethod: PaymentMethodEnum;

  @IsNumber()
  @IsNotEmpty()
  partnerTierId: number;

  @IsNumber()
  @IsOptional()
  defaultPaymentMethodId?: number;

  @IsString()
  @IsOptional()
  accountIban?: string;

  @IsString()
  @IsOptional()
  bicSwift?: string;

  @IsString()
  @IsOptional()
  responsible?: string; // ✅ New field

  @IsString()
  @IsOptional()
  accessAccountStatus?: 'postpone' | 'request'; // ✅ New field
  
  @IsEmail()
  @IsOptional()
  accessEmail?: string; // Email to send credentials to

  @IsOptional() // ✅ allow it to be missing
  @IsString()
  password?: string;
}
