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

  // Admin/Partner: Get employer by ID
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async findOne(@Param('id') id: string): Promise<BaseResponse<Employer>> {
    return this.employersService.findOne(+id);
  }

  // Admin/Partner: Update employer
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async update(
    @Param('id') id: string,
    @Body() updateEmployerDto: UpdateEmployerDto,
  ): Promise<BaseResponse<Employer>> {
    return this.employersService.update(+id, updateEmployerDto);
  }

  // Admin/Partner: Delete employer
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2)
  async remove(@Param('id') id: string): Promise<BaseResponse<null>> {
    return this.employersService.remove(+id);
  }

  // Employer: Get own data
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return this.employersService.findOne(req.user.sub);
  }

  // Employer: Update own data
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req, @Body() updateEmployerDto: UpdateEmployerDto) {
    return this.employersService.update(req.user.sub, updateEmployerDto);
  }
}