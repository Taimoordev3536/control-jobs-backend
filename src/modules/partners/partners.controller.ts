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
  ParseUUIDPipe,
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

  @Get(':id')
  @Roles(1)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findByPublicId(id);
  }

  @Patch(':id')
  @Roles(1)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ) {
    const numericId = await this.partnersService.resolvePublicId(id);
    return this.partnersService.update(numericId, updatePartnerDto);
  }

  @Delete(':id')
  @Roles(1)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.partnersService.resolvePublicId(id);
    return this.partnersService.remove(numericId);
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

  @Get('tiers')
  @Roles(1)
  async findAllTiers(): Promise<BaseResponse<PartnerTier[]>> {
    return this.partnersService.findAllTiers();
  }
}
