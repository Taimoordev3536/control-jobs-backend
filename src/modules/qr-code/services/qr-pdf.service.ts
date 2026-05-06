import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { EmployerClient } from '../../employers/entities/employer-client.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { QrCodeService } from './qr-code.service';
import {
  generateQrPdfBuffer,
  QrPdfTemplateData,
} from '../helpers/qr-pdf-template';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

/**
 * Generates the A5 QR-code PDF for a work center via a pure-JS renderer
 * (`pdfkit`) — no Chromium, no native dependencies, works identically on
 * every Node platform.
 */
@Injectable()
export class QrPdfService {
  constructor(
    @InjectRepository(WorkCenter)
    private readonly workCenterRepo: Repository<WorkCenter>,
    @InjectRepository(EmployerClient)
    private readonly employerClientRepo: Repository<EmployerClient>,
    private readonly qrCodeService: QrCodeService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async generatePdfForWorkCenter(workCenterId: number): Promise<Buffer> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
      relations: ['employer', 'client'],
    });
    if (!workCenter) {
      throw new NotFoundException(`Work center ${workCenterId} not found`);
    }

    // Work centers may be owned by an employer directly or indirectly via a
    // client linked through employer_clients — mirror WorkCentersService.findOne
    // so the footer's employer block renders in both ownership models.
    const employer = await this.resolveEmployer(workCenter);

    const qrCodes = await this.qrCodeService.getWorkCenterQrCodes(workCenterId);
    const selected =
      (qrCodes.staticQr?.isSelected && qrCodes.staticQr) ||
      (qrCodes.dynamicQr?.isSelected && qrCodes.dynamicQr) ||
      qrCodes.staticQr ||
      qrCodes.dynamicQr;
    if (!selected?.qrImage) {
      throw new BadRequestException(
        'No QR code is configured for this work center',
      );
    }

    const logoBuffer = employer?.logoPublicId
      ? (await this.cloudinaryService.fetchPdfBuffer(employer.logoPublicId)) ??
        undefined
      : undefined;

    const templateData: QrPdfTemplateData = {
      qrImage: selected.qrImage,
      workCenterName: workCenter.name ?? '',
      clientName: workCenter.client?.name ?? '',
      employer: employer
        ? {
            name: employer.name,
            address: employer.address,
            postalCode: employer.postalCode,
            city: employer.city,
            province: employer.province,
            logoUrl: employer.logoUrl ?? undefined,
          }
        : undefined,
      logoBuffer,
    };

    return generateQrPdfBuffer(templateData);
  }

  private async resolveEmployer(
    workCenter: WorkCenter,
  ): Promise<Employer | null> {
    if (workCenter.employer) return workCenter.employer;
    if (!workCenter.clientId) return null;

    const link = await this.employerClientRepo.findOne({
      where: { client: { id: workCenter.clientId }, isActive: true },
      relations: ['employer'],
    });
    return link?.employer ?? null;
  }
}
