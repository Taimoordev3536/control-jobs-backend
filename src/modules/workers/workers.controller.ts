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
