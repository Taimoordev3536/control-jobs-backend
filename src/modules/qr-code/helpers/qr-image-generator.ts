import * as QRCode from 'qrcode';

export class QrImageGenerator {
  /**
   * Generate QR code image as base64 data URL
   */
  static async generateQrImage(token: string, options?: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }): Promise<string> {
    const defaultOptions = {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M' as const,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    };

    const qrOptions = { ...defaultOptions, ...options };

    try {
      const qrImage = await QRCode.toDataURL(token, qrOptions);
      return qrImage;
    } catch (error) {
      console.error('Error generating QR code image:', error);
      throw new Error('Failed to generate QR code image');
    }
  }

  /**
   * Generate high-quality QR code for printing
   */
  static async generatePrintQrImage(token: string): Promise<string> {
    return this.generateQrImage(token, {
      width: 512,
      margin: 4,
      errorCorrectionLevel: 'H',
    });
  }
}
