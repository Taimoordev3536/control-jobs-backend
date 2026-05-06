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
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployersService } from './employers.service';
import { CreateEmployerDto } from './dto/create-employer.dto';
import { UpdateEmployerDto } from './dto/update-employer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { Employer } from './entities/employer.entity';
import { AuthService } from '../auth/auth.service';

@Controller('employers')
export class EmployersController {
  constructor(
    private readonly employersService: EmployersService,
    private readonly authService: AuthService,
  ) { }

  // Admin/Partner: Create employer
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2) // 1=Admin, 2=Partner
  async create(@Body() createEmployerDto: CreateEmployerDto): Promise<BaseResponse<Employer>> {
    return this.employersService.create(createEmployerDto);
  }

  // Admin/Partner: List all employers
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async findAll(@Query('partnerId') partnerId?: number): Promise<BaseResponse<Employer[]>> {
    return this.employersService.findAll(partnerId);
  }

  // Employer: Get own data (must be before :id to avoid conflict)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.findOne(employerId);
  }

  // Employer: Update own data (must be before :id to avoid conflict)
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() updateEmployerDto: UpdateEmployerDto) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.update(employerId, updateEmployerDto);
  }

  // Admin/Partner: Get employer by UUID
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employersService.findByPublicId(id);
  }

  // Admin/Partner: Update employer
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployerDto: UpdateEmployerDto,
  ) {
    const numericId = await this.employersService.resolvePublicId(id);
    return this.employersService.update(numericId, updateEmployerDto);
  }

  // Admin/Partner: Delete employer
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.employersService.resolvePublicId(id);
    return this.employersService.remove(numericId);
  }

  // Employer self-service: upload/remove own company logo. The avatar
  // dropdown ("Mis Datos") routes here for employer-role users.
  @Post('me/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.setLogo(employerId, file);
  }

  @Delete('me/logo')
  @UseGuards(JwtAuthGuard)
  async deleteMyLogo(@Request() req) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.clearLogo(employerId);
  }

  // Employer self-service: capture (or change) the payment method. Triggered
  // by the AWAITING_PAYMENT_METHOD banner on the employer dashboard once
  // the trial ends. Stamps `paymentMethodAddedAt` and (if applicable) flips
  // billing_status from AWAITING_PAYMENT_METHOD → ACTIVE.
  @Post('me/payment-method')
  @UseGuards(JwtAuthGuard)
  async setMyPaymentMethod(
    @Request() req,
    @Body() body: { paymentMethodId: number },
  ) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.recordPaymentMethod(
      employerId,
      Number(body?.paymentMethodId),
    );
  }

  // Admin/Partner: upload/remove a logo on behalf of any employer.
  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const numericId = await this.employersService.resolvePublicId(id);
    return this.employersService.setLogo(numericId, file);
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async deleteLogo(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.employersService.resolvePublicId(id);
    return this.employersService.clearLogo(numericId);
  }
}
