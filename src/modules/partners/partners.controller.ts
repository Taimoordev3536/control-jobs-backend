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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

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
  // Admin only: carries NIF, IBAN, BIC and retention. Partner-facing pickers
  // use /partners/options instead.
  @Get()
  @Roles(1)
  async findAll(): Promise<BaseResponse<Partner[]>> {
    return this.partnersService.findAll();
  }

  // Declared before the :id catch-alls so ParseUUIDPipe doesn't reject 'options'.
  @Get('options')
  @Roles(1, 2)
  async findOptions(@Request() req): Promise<BaseResponse<any[]>> {
    return this.partnersService.findOptions(req.user);
  }

  // Partner self-service: declared before the :id catch-alls so ParseUUIDPipe
  // doesn't reject the literal 'me'. This also relocates the original
  // @Get('me')/@Patch('me') (which were buggy below :id) — and switches them
  // to resolve via PartnerUser instead of trusting req.user.sub == partner.id.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    const partnerId = await this.partnersService.findPartnerIdByUserId(req.user.id);
    return this.partnersService.findOne(partnerId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() updatePartnerDto: UpdatePartnerDto) {
    const partnerId = await this.partnersService.findPartnerIdByUserId(req.user.id);
    return this.partnersService.update(partnerId, updatePartnerDto);
  }

  @Post('me/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const partnerId = await this.partnersService.findPartnerIdByUserId(req.user.id);
    return this.partnersService.setLogo(partnerId, file);
  }

  @Delete('me/logo')
  @UseGuards(JwtAuthGuard)
  async deleteMyLogo(@Request() req) {
    const partnerId = await this.partnersService.findPartnerIdByUserId(req.user.id);
    return this.partnersService.clearLogo(partnerId);
  }

  // Admin: upload/remove a logo on behalf of any partner.
  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const numericId = await this.partnersService.resolvePublicId(id);
    return this.partnersService.setLogo(numericId, file);
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1)
  async deleteLogo(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.partnersService.resolvePublicId(id);
    return this.partnersService.clearLogo(numericId);
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

  @Patch(':id/deactivate')
  @Roles(1)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.partnersService.resolvePublicId(id);
    return this.partnersService.setActive(numericId, false);
  }

  @Patch(':id/activate')
  @Roles(1)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.partnersService.resolvePublicId(id);
    return this.partnersService.setActive(numericId, true);
  }

  @Get('tiers')
  @Roles(1)
  async findAllTiers(): Promise<BaseResponse<PartnerTier[]>> {
    return this.partnersService.findAllTiers();
  }
}
