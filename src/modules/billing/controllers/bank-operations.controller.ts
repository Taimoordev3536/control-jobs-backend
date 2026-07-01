import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { BankOperationsService } from '../services/bank-operations.service';
import { BillingAccessService } from '../services/billing-access.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('bank-operations')
@UseGuards(JwtAuthGuard)
export class BankOperationsController {
  constructor(
    private readonly service: BankOperationsService,
    private readonly access: BillingAccessService,
  ) {}

  private async scopeOf(req: any) {
    const scope = await this.access.resolveScope(req.user);
    if (scope.kind === 'partner') throw new ForbiddenException('Not allowed');
    return scope;
  }

  @Get()
  async list(@Req() req: any, @Query('tab') tab: any) {
    const scope = await this.scopeOf(req);
    const data = await this.service.list(scope, tab || 'FACTURAS');
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Post('close')
  async close(@Req() req: any, @Body() body: { tab: any; periodStart: string; periodEnd: string }) {
    const scope = await this.scopeOf(req);
    const data = await this.service.closeMonth(scope, body.tab, body.periodStart, body.periodEnd, 'MANUAL');
    return { message: data ? 'Generated' : 'Nothing to close', data, isSuccess: true, statusCode: 201 };
  }

  @Post(':id/mark-done')
  async markDone(@Req() req: any, @Param('id') id: string) {
    const scope = await this.scopeOf(req);
    const data = await this.service.markDone(id, scope);
    return { message: 'Done', data, isSuccess: true, statusCode: 200 };
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const scope = await this.scopeOf(req);
    return this.service.remove(id, scope);
  }
}
