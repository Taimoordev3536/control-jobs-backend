import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from './entities/faq.entity';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(Faq) private readonly faqRepo: Repository<Faq>,
  ) {}

  list(): Promise<Faq[]> {
    return this.faqRepo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  create(dto: CreateFaqDto): Promise<Faq> {
    const faq = this.faqRepo.create({
      question: dto.question,
      answer: dto.answer,
      audience: dto.audience ?? 'ALL',
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.faqRepo.save(faq);
  }

  async update(publicId: string, dto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.faqRepo.findOne({ where: { publicId } });
    if (!faq) throw new NotFoundException('FAQ not found');
    Object.assign(faq, dto);
    return this.faqRepo.save(faq);
  }

  async remove(publicId: string): Promise<{ isSuccess: boolean }> {
    const faq = await this.faqRepo.findOne({ where: { publicId } });
    if (!faq) throw new NotFoundException('FAQ not found');
    await this.faqRepo.remove(faq);
    return { isSuccess: true };
  }
}
