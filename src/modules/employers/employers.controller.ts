import {
  Controller,
  Get,
  Post,
  Put,
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
import { PendingEmployersService } from './services/pending-employers.service';
import { CreateEmployerDto } from './dto/create-employer.dto';
import { UpdateEmployerDto } from './dto/update-employer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { Employer } from './entities/employer.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

@Controller('employers')
export class EmployersController {
  constructor(
    private readonly employersService: EmployersService,
    private readonly pendingEmployersService: PendingEmployersService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) { }

  // Admin/Partner: Create employer
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2) // 1=Admin, 2=Partner
  async create(
    @Request() req,
    @Body() createEmployerDto: CreateEmployerDto,
  ): Promise<BaseResponse<Employer>> {
    return this.employersService.create(createEmployerDto, req.user);
  }

  // Admin/Partner: List all employers
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async findAll(
    @Request() req,
    // Kept as a string: callers pass the partner publicId (UUID), and a Number
    // metatype would let ValidationPipe coerce it to NaN and silently drop the filter.
    @Query('partnerId') partnerId?: string,
  ): Promise<BaseResponse<Employer[]>> {
    return this.employersService.findAllScoped(req.user, partnerId);
  }

  // Admin/Partner: Pending employer pipeline — invitations not yet redeemed
  // PLUS employers whose users have not verified their email. Must come before
  // ':id' to avoid being parsed as a UUID.
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async findPending(@Request() req) {
    return this.pendingEmployersService.list(req.user);
  }

  // Employer: Get own data (must be before :id to avoid conflict)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return this.employersService.getMe(req.user.id);
  }

  // Employer: Update own data (must be before :id to avoid conflict)
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() updateEmployerDto: UpdateEmployerDto) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.update(employerId, updateEmployerDto);
  }

  @Get('me/tariffs')
  @UseGuards(JwtAuthGuard)
  async getMyTariffs(@Request() req) {
    return this.employersService.getMyTariffs(req.user.id);
  }

  @Put('me/tariffs')
  @UseGuards(JwtAuthGuard)
  async updateMyTariffs(@Request() req, @Body() body: { billing?: any; salary?: any }) {
    return this.employersService.updateMyTariffs(req.user.id, body);
  }

  @Get('me/holidays')
  @UseGuards(JwtAuthGuard)
  async getMyHolidays(@Request() req) {
    return this.employersService.getMyHolidays(req.user.id);
  }

  @Post('me/holidays')
  @UseGuards(JwtAuthGuard)
  async addMyHoliday(@Request() req, @Body() body: { date?: string; name?: string }) {
    return this.employersService.addMyHoliday(req.user.id, body);
  }

  @Delete('me/holidays/:hid')
  @UseGuards(JwtAuthGuard)
  async deleteMyHoliday(@Request() req, @Param('hid', ParseUUIDPipe) hid: string) {
    return this.employersService.deleteMyHoliday(req.user.id, hid);
  }

  // Admin/Partner: Get employer by UUID
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    // Scoped like deactivate/activate already are: without this a partner
    // could read any other partner's employer by public id.
    const numericId = await this.employersService.resolvePublicId(id);
    await this.employersService.assertCanManageEmployer(req.user, numericId);
    return this.employersService.findByPublicId(id);
  }

  // Admin/Partner: Update employer
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployerDto: UpdateEmployerDto,
  ) {
    const numericId = await this.employersService.resolvePublicId(id);
    await this.employersService.assertCanManageEmployer(req.user, numericId);
    return this.employersService.update(numericId, updateEmployerDto);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async deactivate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.employersService.resolvePublicId(id);
    await this.employersService.assertCanManageEmployer(req.user, numericId);
    const res = await this.employersService.setActive(numericId, false);
    await this.audit.record({
      actorUserId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role?.name,
      action: 'EMPLOYER_DEACTIVATED',
      detail: `Employer ${id}`,
    });
    return res;
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async activate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.employersService.resolvePublicId(id);
    await this.employersService.assertCanManageEmployer(req.user, numericId);
    const res = await this.employersService.setActive(numericId, true);
    await this.audit.record({
      actorUserId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role?.name,
      action: 'EMPLOYER_ACTIVATED',
      detail: `Employer ${id}`,
    });
    return res;
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

  // Employer self-service: upload/remove the identity photo shown in the
  // nav avatar and other "this is me" surfaces. Separate from /me/logo,
  // which is the brand image printed on QR-code PDFs.
  @Post('me/profile-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyProfilePhoto(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.setProfilePhoto(employerId, file);
  }

  @Delete('me/profile-photo')
  @UseGuards(JwtAuthGuard)
  async deleteMyProfilePhoto(@Request() req) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.clearProfilePhoto(employerId);
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

  // Employer self-service: cancel the subscription. Required by the EU
  // non-binding-services rule cited by the client — customers must be able
  // to opt out before any pending rate change takes effect.
  @Post('me/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelMySubscription(@Request() req) {
    const employerId = await this.employersService.findEmployerIdByUserId(req.user.id);
    return this.employersService.cancelSubscription(employerId);
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

  // Admin/Partner: manage an employer's identity photo on their behalf.
  @Post(':id/profile-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const numericId = await this.employersService.resolvePublicId(id);
    return this.employersService.setProfilePhoto(numericId, file);
  }

  @Delete(':id/profile-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async deleteProfilePhoto(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.employersService.resolvePublicId(id);
    return this.employersService.clearProfilePhoto(numericId);
  }
}
