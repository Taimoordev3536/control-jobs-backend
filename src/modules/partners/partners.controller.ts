import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';

import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { Partner } from './entities/partner.entity';
import { PartnerTier } from './entities/partner-type.entity';
import { AuthService } from '../auth/auth.service';

@Controller('partners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnersController {
  private readonly logger = new Logger(PartnersController.name);

  constructor(
    private readonly partnersService: PartnersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Create a new partner
   * @param createPartnerDto - Partner creation data
   * @returns Created partner data
   */
  @Post()
  @Roles(1) // Admin role
  async create(
    @Body() createPartnerDto: CreatePartnerDto,
    @Request() req,
  ): Promise<BaseResponse<Partner>> {
    this.logger.log('Creating partner with data:', createPartnerDto);
    this.logger.log('User from request:', req.user);
    return this.partnersService.create(createPartnerDto);
  }

  /**
   * Get all partners
   * @returns List of all partners
   */
  @Get()
  @Roles(1, 2) // Admin role
  async findAll(): Promise<BaseResponse<Partner[]>> {
    return this.partnersService.findAll();
  }

  /**
   * Get a partner by ID
   * @param id - Partner ID
   * @returns Partner data
   */
  @Get(':id')
  @Roles(1) // Admin role
  async findOne(@Param('id') id: string): Promise<BaseResponse<Partner>> {
    return this.partnersService.findOne(+id);
  }

  /**
   * Update a partner
   * @param id - Partner ID
   * @param updatePartnerDto - Partner update data
   * @returns Updated partner data
   */
  @Patch(':id')
  @Roles(1) // Admin role
  async update(
    @Param('id') id: string,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ): Promise<BaseResponse<Partner>> {
    return this.partnersService.update(+id, updatePartnerDto);
  }

  /**
   * Delete a partner
   * @param id - Partner ID
   * @returns Success message
   */
  @Delete(':id')
  @Roles(1) // Admin role
  async remove(@Param('id') id: string): Promise<BaseResponse<null>> {
    return this.partnersService.remove(+id);
  }

  // Partner: Get own data
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return this.partnersService.findOne(req.user.sub);
  }

  // Partner: Update own data
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() updatePartnerDto: UpdatePartnerDto) {
    return this.partnersService.update(req.user.sub, updatePartnerDto);
  }

  /**
   * Get all partner tiers
   * @returns List of all partner tiers
   */
  @Get('tiers')
  @Roles(1) // Admin role
  async findAllTiers(): Promise<BaseResponse<PartnerTier[]>> {
    return this.partnersService.findAllTiers();
  }
}
