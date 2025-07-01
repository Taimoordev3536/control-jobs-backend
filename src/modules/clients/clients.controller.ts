import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  Delete,
  ParseIntPipe,
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
  getUsers(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.getUsersByClient(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async createByEmployer(@Body() dto: any, @Req() req) {
    // req.user is populated by JwtAuthGuard
    return this.clientsService.createByEmployer(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findAllByEmployer(@Req() req) {
    // Only return clients for the logged-in employer
    return this.clientsService.findAllByEmployerUser(req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findOneByEmployer(@Param('id', ParseIntPipe) id: number, @Req() req) {
    // Optionally, check employer ownership
    return this.clientsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async updateByEmployer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @Req() req,
  ) {
    // Optionally, check employer ownership
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async removeByEmployer(@Param('id', ParseIntPipe) id: number, @Req() req) {
    // Optionally, check employer ownership
    return this.clientsService.remove(id);
  }
}
