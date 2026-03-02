import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { QrCode, QrCodeType } from '../entities/qr-code.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { QrImageGenerator } from '../helpers/qr-image-generator';

@Injectable()
export class QrEmailService {
  private readonly logger = new Logger(QrEmailService.name);
  private resendClient: any;

  constructor(
    @InjectRepository(QrCode)
    private qrCodeRepo: Repository<QrCode>,
    @InjectRepository(WorkCenter)
    private workCenterRepo: Repository<WorkCenter>,
    private configService: ConfigService,
  ) {
    // Initialize Resend client (same as EmailService)
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        this.resendClient = new Resend(resendApiKey);
      } catch (err) {
        this.logger.warn('Failed to initialize Resend client:', err);
      }
    }
  }

  /**
   * Send static QR code to client via email
   */
  async sendStaticQrEmail(
    workCenterId: number,
    clientEmail: string,
    includeInstructions: boolean = true,
  ): Promise<{ success: boolean; message: string; sentAt: Date }> {
    this.logger.log(`Sending static QR email to ${clientEmail} for work center ${workCenterId}`);

    // Get work center
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
    });

    if (!workCenter) {
      throw new NotFoundException(`Work center with ID ${workCenterId} not found`);
    }

    // Get static QR code
    const staticQr = await this.qrCodeRepo.findOne({
      where: {
        workCenterId,
        type: QrCodeType.STATIC,
        isActive: true,
      },
    });

    if (!staticQr) {
      throw new NotFoundException('No active static QR code found for this work center');
    }

    // Generate high-quality QR image for printing
    const qrImage = await QrImageGenerator.generatePrintQrImage(staticQr.token);

    // Create email content
    const emailContent = this.createEmailTemplate(
      workCenter,
      qrImage,
      includeInstructions,
    );

    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    const emailSubject = `Código QR Estático - ${workCenter.name}`;

    // Send email via Resend
    try {
      if (fromEmail && this.resendClient && this.resendClient.emails) {
        // Use RESEND_TO_EMAIL override for testing (sandbox sender can only deliver to verified email)
        const overrideTo = this.configService.get<string>('RESEND_TO_EMAIL');
        const finalTo = overrideTo || clientEmail;
        if (overrideTo) {
          this.logger.log(`RESEND_TO_EMAIL override active: sending to ${overrideTo} instead of ${clientEmail}`);
        }
        const response = await this.resendClient.emails.send({
          from: fromEmail,
          to: finalTo,
          subject: emailSubject,
          html: emailContent,
        });

        this.logger.log(`Email sent successfully to ${clientEmail}`, response);

        if (response && (response as any).error) {
          this.logger.error(`Resend error: ${(response as any).error}`);
          throw new Error((response as any).error.message || 'Failed to send email');
        }

        return {
          success: true,
          message: `Static QR code email sent to ${clientEmail}`,
          sentAt: new Date(),
        };
      } else {
        // Fallback: Log the email content if Resend is not configured
        this.logger.warn('RESEND_FROM_EMAIL or RESEND_API_KEY not configured. Email not sent.');
        this.logger.log('=== QR CODE EMAIL (NOT SENT - RESEND NOT CONFIGURED) ===');
        this.logger.log(`To: ${clientEmail}`);
        this.logger.log(`Subject: ${emailSubject}`);
        this.logger.log('=== END EMAIL ===');

        return {
          success: true,
          message: `Static QR code email prepared for ${clientEmail} (Resend not configured)`,
          sentAt: new Date(),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${clientEmail}:`, error);
      throw error;
    }
  }

  /**
   * Create email template
   */
  private createEmailTemplate(
    workCenter: WorkCenter,
    qrImage: string,
    includeInstructions: boolean,
  ): string {
    const instructionsHtml = includeInstructions
      ? `
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <h3 style="color: #333; margin-top: 0;">📋 Instructions</h3>
          <ol style="color: #666; line-height: 1.8;">
            <li>Print this QR code in high quality (preferably color)</li>
            <li>Place it at the entrance or designated check-in area</li>
            <li>Ensure the QR code is clearly visible and easily accessible</li>
            <li>Workers will scan this code to check in/out</li>
            <li>This is a permanent static QR code - it will not expire</li>
          </ol>
        </div>
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Static QR Code - ${workCenter.name}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🏢 Static QR Code</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              ${workCenter.name}
            </p>
          </div>

          <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #555;">
              Hello,
            </p>
            <p style="font-size: 16px; color: #555;">
              Please find attached the <strong>Static QR Code</strong> for the work center located at:
            </p>

            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
              <p style="margin: 0; color: #333;">
                <strong>📍 Address:</strong><br>
                ${workCenter.address}
              </p>
              ${workCenter.contactName ? `
                <p style="margin: 10px 0 0 0; color: #333;">
                  <strong>👤 Contact:</strong> ${workCenter.contactName}
                </p>
              ` : ''}
              ${workCenter.contactPhone ? `
                <p style="margin: 10px 0 0 0; color: #333;">
                  <strong>📞 Phone:</strong> ${workCenter.contactPhone}
                </p>
              ` : ''}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <img src="${qrImage}" alt="Static QR Code" style="max-width: 300px; width: 100%; border: 2px solid #e0e0e0; border-radius: 8px; padding: 10px; background: white;">
              <p style="color: #888; font-size: 14px; margin-top: 10px;">
                Static QR Code (Never Expires)
              </p>
            </div>

            ${instructionsHtml}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 14px;">
              <p style="margin: 0;">
                This email was sent automatically by the ControlJobs system.
              </p>
              <p style="margin: 10px 0 0 0;">
                If you have any questions, please contact your administrator.
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} ControlJobs. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Preview email content (for testing)
   */
  async previewEmail(workCenterId: number, includeInstructions: boolean = true): Promise<string> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
    });

    if (!workCenter) {
      throw new NotFoundException(`Work center with ID ${workCenterId} not found`);
    }

    const staticQr = await this.qrCodeRepo.findOne({
      where: {
        workCenterId,
        type: QrCodeType.STATIC,
        isActive: true,
      },
    });

    if (!staticQr) {
      throw new NotFoundException('No active static QR code found');
    }

    const qrImage = await QrImageGenerator.generatePrintQrImage(staticQr.token);
    return this.createEmailTemplate(workCenter, qrImage, includeInstructions);
  }
}
