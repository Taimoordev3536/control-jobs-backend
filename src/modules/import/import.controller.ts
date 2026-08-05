import { Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { ImportService, ImportType } from './import.service';
import { AuditService } from '../audit/audit.service';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class ImportController {
  constructor(private readonly importService: ImportService,
    private readonly audit: AuditService,
  ) {}

  @Post(':type')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Req() req: any,
    @Param('type') type: ImportType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.importService.importCsv(type, file);
    await this.audit.record({
      actorUserId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role?.name,
      action: 'DATA_IMPORTED',
      detail: `${type} — ${file?.originalname ?? 'file'}: `
        + `${data.imported} of ${data.total} imported, ${data.skipped} skipped, ${data.failed} failed`,
    });
    return { isSuccess: true, statusCode: 200, message: 'Import processed', data };
  }
}
