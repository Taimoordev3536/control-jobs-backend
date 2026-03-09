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
} from '@nestjs/common';
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
    return this.employersService.findOne(req.user.sub);
  }

  // Employer: Update own data (must be before :id to avoid conflict)
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() updateEmployerDto: UpdateEmployerDto) {
    return this.employersService.update(req.user.sub, updateEmployerDto);
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
}
