import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';

export type PaymentMethodContext = 'SELF_SERVICE' | 'ADMIN_ASSIGN';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly repo: Repository<PaymentMethod>,
  ) {}

  async list(opts: { selfServiceOnly?: boolean } = {}): Promise<PaymentMethod[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (opts.selfServiceOnly) where.isSelfService = true;
    return this.repo.find({
      where,
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  async assertEligible(
    paymentMethodId: number | null | undefined,
    context: PaymentMethodContext,
  ): Promise<void> {
    if (paymentMethodId === null || paymentMethodId === undefined) return;
    const pm = await this.repo.findOne({
      where: { id: paymentMethodId, isActive: true },
    });
    if (!pm) {
      throw new BadRequestException('Invalid payment method');
    }
    if (context === 'SELF_SERVICE' && !pm.isSelfService) {
      throw new BadRequestException(
        'This payment method is not available for self-service signup',
      );
    }
  }
}
