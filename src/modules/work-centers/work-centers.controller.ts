import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { WorkCentersService } from './work-centers.service';
import { CreateWorkCenterDto } from './dto/create-work-center.dto';
import { UpdateWorkCenterDto } from './dto/update-work-center.dto';
import { QueryWorkCenterDto } from './dto/query-work-center.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('work-centers')
@UseGuards(JwtAuthGuard)
export class WorkCentersController {
  constructor(private readonly workCentersService: WorkCentersService) {}

  /**
   * Create a new work center
   * POST /work-centers
   */
  @Post()
  async create(@Body() dto: CreateWorkCenterDto, @Req() req) {
    const workCenter = await this.workCentersService.create(dto, req.user);
    return {
      message: 'Work center created successfully',
      data: workCenter,
      statusCode: 201,
    };
  }

  /**
   * Get all work centers (with filters)
   * GET /work-centers
   */
  @Get()
  async findAll(@Query() query: QueryWorkCenterDto, @Req() req) {
    const result = await this.workCentersService.findAll(query, req.user);
    return {
      message: 'Work centers retrieved successfully',
      data: result.data,
      meta: {
        total: result.total,
        page: query.page || 1,
        limit: query.limit || 10,
      },
      statusCode: 200,
    };
  }

  /**
   * Get one work center by ID
   * GET /work-centers/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const workCenter = await this.workCentersService.findOne(id, req.user);
    return {
      message: 'Work center retrieved successfully',
      data: workCenter,
      statusCode: 200,
    };
  }

  /**
   * Update a work center
   * PUT /work-centers/:id
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkCenterDto,
    @Req() req,
  ) {
    const workCenter = await this.workCentersService.update(id, dto, req.user);
    return {
      message: 'Work center updated successfully',
      data: workCenter,
      statusCode: 200,
    };
  }

  /**
   * Delete a work center
   * DELETE /work-centers/:id
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const result = await this.workCentersService.remove(id, req.user);
    return {
      message: result.message,
      statusCode: 200,
    };
  }
}
