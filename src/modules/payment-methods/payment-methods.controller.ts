import { Controller, Get, Query } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @Get()
  async list(@Query('selfServiceOnly') selfServiceOnly?: string) {
    const data = await this.service.list({
      selfServiceOnly: selfServiceOnly === 'true',
    });
    return {
      data: data.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        isSelfService: m.isSelfService,
        displayOrder: m.displayOrder,
      })),
      isSuccess: true,
    };
  }
}
