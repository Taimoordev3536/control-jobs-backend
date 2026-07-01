import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { AssignClientUserDto } from './dto/assign-client-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('client')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('/assign-user')
  assignUser(@Body() dto: AssignClientUserDto) {
    return this.clientsService.assignUser(dto);
  }

  @Get(':id/users')
  async getUsers(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.getUsersByClient(numericId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async createByEmployer(@Body() dto: any, @Req() req) {
    return this.clientsService.createByEmployer(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findAllByEmployer(@Req() req) {
    return this.clientsService.findAllByEmployerUser(req.user);
  }

  // Must precede @Get(':id') so "admin" isn't parsed as a UUID param.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  async findAllForAdmin() {
    return this.clientsService.findAllForAdmin();
  }

  @Get('for-add-job')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findClientsForAddJob(@Req() req) {
    return this.clientsService.findClientsForAddJob(req.user);
  }

  @Get('all/invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async listAllInvoices(@Req() req) {
    return this.clientsService.listAllClientInvoicesForEmployer(req.user.id);
  }

  @Get('me/invoices')
  @UseGuards(JwtAuthGuard)
  async listMyInvoices(@Req() req) {
    return this.clientsService.listMyClientInvoices(req.user.id);
  }

  @Get('me/invoices/:invoiceId/pdf')
  @UseGuards(JwtAuthGuard)
  async myInvoicePdf(@Req() req, @Param('invoiceId', ParseUUIDPipe) invoiceId: string, @Res() res: Response) {
    const clientId = await this.clientsService.findClientIdByUserId(req.user.id);
    const { buffer, fileName } = await this.clientsService.renderClientInvoicePdf(clientId, invoiceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  // Client self-service: upload/remove company logo. Declared before :id so
  // ParseUUIDPipe doesn't reject "me".
  @Post('me/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const clientId = await this.clientsService.findClientIdByUserId(req.user.id);
    return this.clientsService.setLogo(clientId, file);
  }

  @Delete('me/logo')
  @UseGuards(JwtAuthGuard)
  async deleteMyLogo(@Request() req) {
    const clientId = await this.clientsService.findClientIdByUserId(req.user.id);
    return this.clientsService.clearLogo(clientId);
  }

  // Client self-service: read own row (so the dropdown can fetch logoUrl).
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    const clientId = await this.clientsService.findClientIdByUserId(req.user.id);
    const data = await this.clientsService.findOne(clientId);
    return {
      message: 'Client retrieved',
      data,
      isSuccess: true,
      statusCode: 200,
    };
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() dto: UpdateClientDto) {
    const clientId = await this.clientsService.findClientIdByUserId(req.user.id);
    return this.clientsService.update(clientId, dto);
  }

  // Employer: upload/remove a logo on behalf of one of their clients.
  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const numericId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.setLogo(numericId, file);
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async deleteLogo(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.clearLogo(numericId);
  }

  @Get(':id/files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async listFiles(@Param('id', ParseUUIDPipe) id: string) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.listClientFiles(clientId);
  }

  @Post(':id/files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
    @Req() req,
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.uploadClientFile(clientId, file, description, req.user?.id);
  }

  @Delete(':id/files/:fileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    await this.clientsService.deleteClientFile(clientId, fileId);
    return { isSuccess: true };
  }

  @Get(':id/billing-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async getBillingConfig(@Param('id', ParseUUIDPipe) id: string) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.getClientBillingConfig(clientId);
  }

  @Put(':id/billing-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async updateBillingConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fixedAmount?: number | null; hoursLabel?: string; hourRate?: number | null; vatPct?: number },
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.updateClientBillingConfig(clientId, body);
  }

  @Get(':id/invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async listInvoices(@Param('id', ParseUUIDPipe) id: string) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.listClientInvoices(clientId);
  }

  @Get(':id/invoices/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async previewInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.previewClientInvoice(clientId, periodStart, periodEnd);
  }

  @Post(':id/invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async createInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @Req() req,
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    return this.clientsService.createClientInvoice(clientId, body, req.user?.id);
  }

  @Delete(':id/invoices/:invoiceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async deleteInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    await this.clientsService.deleteClientInvoice(clientId, invoiceId);
    return { isSuccess: true };
  }

  @Get(':id/invoices/:invoiceId/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async invoicePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Res() res: Response,
  ) {
    const clientId = await this.clientsService.resolvePublicId(id);
    const { buffer, fileName } = await this.clientsService.renderClientInvoicePdf(clientId, invoiceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findOneByEmployer(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findByPublicId(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async updateByEmployer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.updateByPublicId(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async removeByEmployer(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.removeByPublicId(id);
  }
}
