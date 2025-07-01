import { IsString, IsEmail, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEmployerUserDto {
    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;
}

export class UpdateEmployerDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    taxId?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsNumber()
    @IsOptional()
    partnerId?: number;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    landline?: string;

    @IsNumber()
    @IsOptional()
    typeId?: number;

    @IsNumber()
    @IsOptional()
    subTypeId?: number;

    @IsNumber()
    @IsOptional()
    fee?: number;

    @IsNumber()
    @IsOptional()
    discount?: number;

    @IsNumber()
    @IsOptional()
    paymentMethodId?: number;

    @IsString()
    @IsOptional()
    accountIban?: string;

    @IsString()
    @IsOptional()
    bicSwift?: string;

    @IsString()
    @IsOptional()
    probationPeriod?: string;

    @ValidateNested()
    @Type(() => UpdateEmployerUserDto)
    @IsOptional()
    user?: UpdateEmployerUserDto;
}
