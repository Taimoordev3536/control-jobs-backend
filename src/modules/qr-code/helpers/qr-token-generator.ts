import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { QrCodeType } from '../entities/qr-code.entity';

export class QrTokenGenerator {
  /**
   * Generate a QR token based on type
   * STATIC: UUIDv4 (permanent)
   * DYNAMIC: 256-bit random base64url (changes every 3 min)
   */
  static generateToken(type: QrCodeType): string {
    if (type === QrCodeType.STATIC) {
      return this.generateStaticToken();
    } else {
      return this.generateDynamicToken();
    }
  }

  /**
   * Generate static QR token (UUIDv4)
   */
  static generateStaticToken(): string {
    return uuidv4();
  }

  /**
   * Generate dynamic QR token (256-bit random, base64url encoded)
   */
  static generateDynamicToken(): string {
    const bytes = crypto.randomBytes(32); // 256 bits
    return bytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Calculate expiry time for dynamic QR (30 seconds from now)
   */
  static calculateDynamicExpiry(): Date {
    const now = new Date();
    return new Date(now.getTime() + 30 * 1000); // 30 seconds
  }
}
