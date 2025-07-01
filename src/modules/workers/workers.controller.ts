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
  getUsers(@Param('id', ParseIntPipe) id: number) {
    return this.workersService.getUsersByWorker(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async createByEmployer(@Body() dto: CreateWorkerDto, @Req() req) {
    // req.user is populated by JwtAuthGuard
    return this.workersService.createByEmployer(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findAllByEmployer(@Req() req) {
    return this.workersService.findAllByEmployer(req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async findOneByEmployer(@Param('id', ParseIntPipe) id: number, @Req() req) {
    // Optionally, check employer ownership
    return this.workersService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async updateByEmployer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkerDto,
    @Req() req
  ) {
    // Optionally, check employer ownership
    return this.workersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async removeByEmployer(@Param('id', ParseIntPipe) id: number, @Req() req) {
    // Optionally, check employer ownership
    return this.workersService.remove(id);
  }
}
