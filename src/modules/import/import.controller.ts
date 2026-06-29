import {
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { ImportService, ImportType } from './import.service';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post(':type')
  @UseInterceptors(FileInterceptor('file'))
  async import(@Param('type') type: ImportType, @UploadedFile() file: Express.Multer.File) {
    const data = await this.importService.importCsv(type, file);
    return { isSuccess: true, statusCode: 200, message: 'Import processed', data };
  }
}
