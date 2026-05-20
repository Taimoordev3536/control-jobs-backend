import { IsString, IsEmail, IsOptional, IsNumber, Max, Min, ValidateNested } from 'class-validator';
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
    partnerId?: string;

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
    @Min(0)
    @Max(100)
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

    @IsString()
    @IsOptional()
    responsible?: string;

    @ValidateNested()
    @Type(() => UpdateEmployerUserDto)
    @IsOptional()
    user?: UpdateEmployerUserDto;
}
