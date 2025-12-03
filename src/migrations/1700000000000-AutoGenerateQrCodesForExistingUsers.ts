import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { QrCodeType, QrCodeOwnerType } from '../modules/job/entities/qr-code.entity';

export class AutoGenerateQrCodesForExistingUsers1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert STATIC and DYNAMIC QR codes for all clients
    const clients = await queryRunner.query('SELECT id FROM clients');
    for (const client of clients) {
      // STATIC
      await queryRunner.query(
        `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), null, null, true)`,
        [uuidv4(), uuidv4(), 'STATIC', 'CLIENT', client.id]
      );
      // DYNAMIC
      const dynamicToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await queryRunner.query(
        `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), $6, now(), true)`,
        [uuidv4(), dynamicToken, 'DYNAMIC', 'CLIENT', client.id, expiresAt]
      );
    }
    // Insert STATIC and DYNAMIC QR codes for all employers
    const employers = await queryRunner.query('SELECT id FROM cjobs_empleadores');
    for (const employer of employers) {
      // STATIC
      await queryRunner.query(
        `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), null, null, true)`,
        [uuidv4(), uuidv4(), 'STATIC', 'EMPLOYER', employer.id]
      );
      // DYNAMIC
      const dynamicToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await queryRunner.query(
        `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), $6, now(), true)`,
        [uuidv4(), dynamicToken, 'DYNAMIC', 'EMPLOYER', employer.id, expiresAt]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM qr_codes');
  }
}
