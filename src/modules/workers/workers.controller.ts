import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  Delete,
  ParseIntPipe,
  ParseUUIDPipe,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async removeByEmployer(@Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.removeByPublicId(id);
  }
}
