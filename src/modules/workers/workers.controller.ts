import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  Patch,
  Delete,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { AssignWorkerUserDto } from './dto/assign-worker-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('worker')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post('/assign-user')
  assignUser(@Body() dto: AssignWorkerUserDto) {
    return this.workersService.assignUser(dto);
  }

  @Get('all/salaries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async listAllSalaries(@Req() req) {
    return this.workersService.listAllSalaryReceiptsForEmployer(req.user.id);
  }

  @Get('me/salaries')
  @UseGuards(JwtAuthGuard)
  async listMySalaries(@Req() req) {
    return this.workersService.listMySalaries(req.user.id);
  }

  @Get('me/salaries/:salaryId/pdf')
  @UseGuards(JwtAuthGuard)
  async mySalaryPdf(@Req() req, @Param('salaryId', ParseUUIDPipe) salaryId: string, @Res() res: Response) {
    const workerId = await this.workersService.findWorkerIdByUserId(req.user.id);
    const { buffer, fileName } = await this.workersService.renderSalaryReceiptPdf(workerId, salaryId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get('me/documents')
  @UseGuards(JwtAuthGuard)
  async listMyDocuments(@Req() req) {
    return this.workersService.listMyDocuments(req.user.id);
  }

  @Get(':id/users')
  async getUsers(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.workersService.resolvePublicId(id);
    return this.workersService.getUsersByWorker(numericId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async createByEmployer(@Body() dto: CreateWorkerDto, @Req() req) {
    return this.workersService.createByEmployer(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findAllByEmployer(@Req() req) {
    return this.workersService.findAllByEmployer(req.user);
  }

  // Must precede @Get(':id') so "admin" isn't parsed as a UUID param.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  async findAllForAdmin() {
    return this.workersService.findAllForAdmin();
  }

  // Worker self-service: upload/remove personal photo. Declared before :id so
  // ParseUUIDPipe doesn't reject "me".
  @Post('me/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const workerId = await this.workersService.findWorkerIdByUserId(req.user.id);
    return this.workersService.setLogo(workerId, file);
  }

  @Delete('me/logo')
  @UseGuards(JwtAuthGuard)
  async deleteMyLogo(@Request() req) {
    const workerId = await this.workersService.findWorkerIdByUserId(req.user.id);
    return this.workersService.clearLogo(workerId);
  }

  // Employer: upload/remove a logo on behalf of one of their workers.
  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const numericId = await this.workersService.resolvePublicId(id);
    return this.workersService.setLogo(numericId, file);
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async deleteLogo(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.workersService.resolvePublicId(id);
    return this.workersService.clearLogo(numericId);
  }

  @Get(':id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    const numericId = await this.workersService.resolvePublicId(id);
    return this.workersService.listWorkerDocuments(numericId);
  }

  @Post(':id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
    @Body('category') category: string,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolvePublicId(id);
    return this.workersService.uploadWorkerDocument(numericId, file, description, req.user?.id, category);
  }

  @Delete(':id/documents/:docId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    const numericId = await this.workersService.resolvePublicId(id);
    await this.workersService.deleteWorkerDocument(numericId, docId);
    return { isSuccess: true };
  }

  @Get(':id/salary-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async getSalaryConfig(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.getWorkerSalaryConfig(numericId);
  }

  @Put(':id/salary-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async updateSalaryConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fixedAmount?: number | null; hoursLabel?: string; hourRate?: number | null },
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.updateWorkerSalaryConfig(numericId, body);
  }

  @Get(':id/salaries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async listSalaries(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.listSalaryReceipts(numericId);
  }

  @Get(':id/salaries/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async previewSalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.getWorkerSalaryPreview(numericId, periodStart, periodEnd);
  }

  @Post(':id/salaries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async createSalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.createSalaryReceipt(numericId, body, req.user?.id);
  }

  @Delete(':id/salaries/:salaryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async deleteSalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('salaryId', ParseUUIDPipe) salaryId: string,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    await this.workersService.deleteSalaryReceipt(numericId, salaryId);
    return { isSuccess: true };
  }

  @Post(':id/salaries/:salaryId/mark-paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async markSalaryPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('salaryId', ParseUUIDPipe) salaryId: string,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.markSalaryReceiptPaid(numericId, salaryId);
  }

  @Post(':id/salaries/:salaryId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async cancelSalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('salaryId', ParseUUIDPipe) salaryId: string,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    return this.workersService.cancelSalaryReceipt(numericId, salaryId);
  }

  @Get(':id/salaries/:salaryId/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer, UserRole.Admin)
  async salaryPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('salaryId', ParseUUIDPipe) salaryId: string,
    @Res() res: Response,
    @Req() req,
  ) {
    const numericId = await this.workersService.resolveOwnedWorkerId(id, req.user);
    const { buffer, fileName } = await this.workersService.renderSalaryReceiptPdf(numericId, salaryId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    const workerId = await this.workersService.findWorkerIdByUserId(req.user.id);
    const data = await this.workersService.findOne(workerId);
    return {
      message: 'Worker retrieved',
      data,
      isSuccess: true,
      statusCode: 200,
    };
  }

  // Read-only: workers reachable through this client's jobs. Used by the
  // Clients > Workers tab to show "who works for this client" without making
  // it a real ownership relation.
  @Get('by-client/:publicId')
  @UseGuards(JwtAuthGuard)
  async getWorkersByClient(@Param('publicId', ParseUUIDPipe) publicId: string) {
    return this.workersService.getWorkersByClientPublicId(publicId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() dto: UpdateWorkerDto) {
    const workerId = await this.workersService.findWorkerIdByUserId(req.user.id);
    return this.workersService.update(workerId, dto);
  }

  @Get('find-available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findAvailable(
    @Req() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.workersService.findAvailableWorkers(req.user, startDate, endDate);
  }

  @Get(':id/jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async getWorkerJobs(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.workersService.getWorkerJobs(id, req.user);
  }

  @Get(':id/clients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async getWorkerClients(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.workersService.getWorkerClients(id, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findOneByEmployer(@Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.findByPublicId(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async updateByEmployer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkerDto,
  ) {
    return this.workersService.updateByPublicId(id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async deactivate(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.setActiveByPublicId(id, false, req.user.id);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async activate(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.setActiveByPublicId(id, true, req.user.id);
  }
}
