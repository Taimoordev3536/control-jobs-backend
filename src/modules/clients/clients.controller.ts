import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
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

  @Get('for-add-job')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findClientsForAddJob(@Req() req) {
    return this.clientsService.findClientsForAddJob(req.user);
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
