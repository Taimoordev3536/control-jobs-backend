import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Browser } from 'puppeteer-core';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { EmployerClient } from '../../employers/entities/employer-client.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { QrCodeService } from './qr-code.service';
import { buildQrPdfHtml, QrPdfTemplateData } from '../helpers/qr-pdf-template';

/**
 * Renders the QR-code A5 print template to a PDF via headless Chromium.
 *
 * Uses `puppeteer-core` + `@sparticuz/chromium` because the backend is
 * deployed to Vercel serverless — full `puppeteer` bundles a ~280MB Chromium
 * which blows past the function-size limit. The sparticuz build is a
 * stripped Chromium (~50MB) designed for Lambda/Vercel environments.
 *
 * Browser launch is expensive (~1–2s cold start), so we reuse a single
 * browser instance across requests and close it only when the Nest module
 * is destroyed.
 */
@Injectable()
export class QrPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(QrPdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  constructor(
    @InjectRepository(WorkCenter)
    private readonly workCenterRepo: Repository<WorkCenter>,
    @InjectRepository(EmployerClient)
    private readonly employerClientRepo: Repository<EmployerClient>,
    private readonly qrCodeService: QrCodeService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser.close();
      } catch (err) {
        this.logger.warn(`Failed to close browser cleanly: ${err}`);
      }
      this.browserPromise = null;
    }
  }

  /**
   * Generate an A5 portrait PDF for the work center's currently-selected QR.
   * Throws NotFoundException if the work center doesn't exist, or
   * BadRequestException if QR isn't configured/selected yet.
   */
  async generatePdfForWorkCenter(workCenterId: number): Promise<Buffer> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
      relations: ['employer', 'client'],
    });
    if (!workCenter) {
      throw new NotFoundException(`Work center ${workCenterId} not found`);
    }

    // Work centers can be owned directly by an employer, or indirectly via a
    // client that's linked to an employer through the employer_clients bridge.
    // Mirror the fallback in WorkCentersService.findOne so the footer's
    // employer block renders in both ownership models.
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
          }
        : undefined,
    };

    return this.renderHtmlToPdf(buildQrPdfHtml(templateData));
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

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Use `networkidle0` so all inline data-URL images resolve before the
      // layout is measured, but we still gate PDF generation on our own
      // __qrPdfReady flag — networkidle alone doesn't guarantee the fitter
      // has run.
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => (window as any).__qrPdfReady === true, {
        timeout: 5000,
      });

      const pdf = await page.pdf({
        format: 'A5',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.launchBrowser().catch((err) => {
        // Reset on failure so the next request retries the launch instead of
        // reusing a poisoned promise.
        this.browserPromise = null;
        throw err;
      });
    }
    return this.browserPromise;
  }

  private async launchBrowser(): Promise<Browser> {
    const puppeteer = (await import('puppeteer-core')).default;
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
      // Serverless path: use the stripped Chromium from @sparticuz/chromium.
      const chromium = (await import('@sparticuz/chromium')).default;
      return puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    }

    // Local/dev path: rely on a locally-installed Chrome/Chromium.
    // PUPPETEER_EXECUTABLE_PATH lets devs point at their system browser.
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || this.guessLocalChromePath();
    return puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  private guessLocalChromePath(): string | undefined {
    const platform = process.platform;
    if (platform === 'win32') {
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    }
    if (platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    // Linux — leave undefined and let puppeteer-core error out with a clear
    // message so the operator can set PUPPETEER_EXECUTABLE_PATH.
    return undefined;
  }
}
