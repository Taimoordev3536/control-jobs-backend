import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express'; // Import Express Request
import { User } from '../users/entities/user.entity'; // Import User entity
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/decorators/roles/roles.decorator';
import { UserRole } from 'src/utils/enum';
import { AuthUser } from 'src/decorators/auth-user.decorator';

@Controller('receipts')
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) { }

  @Post()
  @UseGuards(PassportJwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File, // Use Multer.File
    @Body('amount') amount: number,
    // Add pfrReceiptNumber, it should regex  /^[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-\d+$/
    @Body('pfrReceiptNumber') pfrReceiptNumber: string,
    @Body('city') city: string,
    @Body('retailStore') retailStore: string,
    @AuthUser() user: User,
  ) {
    if (!file) {
      throw new Error('Please upload a file');
    }
    // if (pfrReceiptNumber && !/^[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-\d+$/.test(pfrReceiptNumber)) {
    //   throw new Error("Invalid PFR receipt number");
    // }
    return this.receiptsService.createReceipt({
      userId: user.id,
      amount,
      file,
      pfrReceiptNumber,
      city,
      retailStore,
    });
  }

  @UseGuards(PassportJwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: User }, // Type req with User
  ) {
    return this.receiptsService.approveReceipt(id, req.user);
  }

  @UseGuards(PassportJwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: User }, // Type req with User
    @Body('reason') reason: string,
  ) {
    return this.receiptsService.rejectReceipt(id, req.user, reason);
  }
}
