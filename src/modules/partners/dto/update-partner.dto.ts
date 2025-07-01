import { PartialType } from '@nestjs/mapped-types';
import { CreatePartnerDto } from './create-partner.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {
    @IsString()
    @IsOptional()
    password?: string;
}
