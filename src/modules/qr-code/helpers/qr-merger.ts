import { MergedQrData } from '../interfaces/qr-interfaces';
import { QrImageGenerator } from './qr-image-generator';

export class QrMerger {
  /**
   * Create merged token from multiple work center QR codes
   */
  static createMergedToken(mergedData: MergedQrData): string {
    const tokenData = {
      wc: mergedData.workCenters.map(wc => ({
        id: wc.id,
        n: wc.name,
        t: wc.tokens,
      })),
      j: mergedData.jobId,
      ts: mergedData.generatedAt,
    };

    // Encode as base64
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  /**
   * Parse merged token back to data
   */
  static parseMergedToken(token: string): MergedQrData | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const data = JSON.parse(decoded);

      return {
        workCenters: data.wc.map(wc => ({
          id: wc.id,
          name: wc.n,
          tokens: wc.t,
          type: this.determineType(wc.t),
        })),
        jobId: data.j,
        generatedAt: data.ts,
      };
    } catch (error) {
      console.error('Error parsing merged token:', error);
      return null;
    }
  }

  /**
   * Check if a token is a merged token
   */
  static isMergedToken(token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const data = JSON.parse(decoded);
      return data && Array.isArray(data.wc) && typeof data.j === 'number';
    } catch {
      return false;
    }
  }

  /**
   * Generate QR image from merged token
   */
  static async generateMergedQrImage(mergedToken: string): Promise<string> {
    return QrImageGenerator.generateQrImage(mergedToken);
  }

  /**
   * Determine QR type from tokens array
   */
  private static determineType(tokens: string[]): 'static' | 'dynamic' | 'both' {
    if (tokens.length === 1) {
      // If single token, assume it's the selected one
      return 'dynamic'; // Default for safety
    } else if (tokens.length === 2) {
      return 'both';
    }
    return 'static';
  }
}
