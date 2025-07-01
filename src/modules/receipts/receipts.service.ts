import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AwsService } from '../aws/aws.service';
import { Receipt } from './receipts.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private receiptsRepository: Repository<Receipt>,
    private awsService: AwsService,
  ) {}

  async createReceipt({
    userId,
    amount,
    file,
    pfrReceiptNumber,
    city,
    retailStore,
  }: {
    userId: number;
    amount: number;
    file: Express.Multer.File;
    pfrReceiptNumber: string;
    city: string;
    retailStore: string;
  }): Promise<Receipt> {
    if (!file) throw new BadRequestException('Receipt image is required');
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const imageUrl = await this.awsService.uploadFile({ file, userId });
    const receipt = this.receiptsRepository.create({
      pfrReceiptNumber,
      userId,
      imageUrl,
      amount,
      city,
      retailStore,
    });

    return this.receiptsRepository.save(receipt);
  }

  async approveReceipt(receiptId: number, admin: User): Promise<Receipt> {
    const receipt = await this.receiptsRepository.findOneOrFail({
      where: { id: receiptId },
      relations: ['user'],
    });

    if (receipt.status !== 'pending') {
      throw new BadRequestException('Receipt already processed');
    }

    const points = Math.min(+receipt.amount, 2000);
    receipt.status = 'approved';
    receipt.pointsAwarded = points;
    receipt.approvedOrRejectedBy = admin.id;

    await this.receiptsRepository.save(receipt);
    // await this.pointsService.addPoints({ userId: receipt.user.id, points });
    return receipt;
  }

  async rejectReceipt(
    receiptId: number,
    admin: User,
    reason: string = 'No reason provided, could be due to invalid receipt, or cheating, contact support for more information',
  ): Promise<Receipt> {
    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    if (receipt.status !== 'pending') {
      throw new BadRequestException('Receipt already processed');
    }

    receipt.status = 'rejected';
    receipt.rejectionReason = reason;
    receipt.approvedOrRejectedBy = admin.id;

    return this.receiptsRepository.save(receipt);
  }

  async overviewStats() {
    const totalReceipts = await this.receiptsRepository.count();
    const pendingReceipts = await this.receiptsRepository.count({
      where: { status: 'pending' },
    });
    const approvedReceipts = await this.receiptsRepository.count({
      where: { status: 'approved' },
    });
    const rejectedReceipts = await this.receiptsRepository.count({
      where: { status: 'rejected' },
    });

    const urgentReceipts = await this.receiptsRepository

      .createQueryBuilder('receipt')
      .where('receipt.status = :status', { status: 'pending' })
      // where only 24 hours left in 72 hours deadline in createdAt
      .andWhere('receipt.createdAt < :deadline', {
        deadline: new Date(Date.now() - 48 * 60 * 60 * 1000),
      })
      .getCount();

    return {
      totalReceipts,
      pendingReceipts,
      approvedReceipts,
      rejectedReceipts,
      urgentReceipts,
    };
  }
}
