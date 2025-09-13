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

  // @IsString()
  // @IsOptional()
  // addressFloorDoor?: string;

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
