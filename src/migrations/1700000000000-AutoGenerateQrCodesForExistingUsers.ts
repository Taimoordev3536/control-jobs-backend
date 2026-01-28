import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { QrCodeType } from '../modules/qr-code/entities/qr-code.entity';

// Legacy QrCodeOwnerType for old migration
enum QrCodeOwnerType {
  CLIENT = 'CLIENT',
  EMPLOYER = 'EMPLOYER',
}

export class AutoGenerateQrCodesForExistingUsers1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert STATIC and DYNAMIC QR codes for all clients (skip if exists)
    const clients = await queryRunner.query('SELECT id FROM clients');
    for (const client of clients) {
      // Check if STATIC already exists
      const existingStatic = await queryRunner.query(
        `SELECT id FROM qr_codes WHERE "ownerType" = $1 AND "ownerId" = $2 AND type = $3`,
        ['CLIENT', client.id, 'STATIC']
      );
      if (existingStatic.length === 0) {
        await queryRunner.query(
          `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), null, null, true)`,
          [uuidv4(), uuidv4(), 'STATIC', 'CLIENT', client.id]
        );
      }
      // Check if DYNAMIC already exists
      const existingDynamic = await queryRunner.query(
        `SELECT id FROM qr_codes WHERE "ownerType" = $1 AND "ownerId" = $2 AND type = $3`,
        ['CLIENT', client.id, 'DYNAMIC']
      );
      if (existingDynamic.length === 0) {
        const dynamicToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await queryRunner.query(
          `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), $6, now(), true)`,
          [uuidv4(), dynamicToken, 'DYNAMIC', 'CLIENT', client.id, expiresAt]
        );
      }
    }
    // Insert STATIC and DYNAMIC QR codes for all employers (skip if exists)
    const employers = await queryRunner.query('SELECT id FROM cjobs_empleadores');
    for (const employer of employers) {
      // Check if STATIC already exists
      const existingStatic = await queryRunner.query(
        `SELECT id FROM qr_codes WHERE "ownerType" = $1 AND "ownerId" = $2 AND type = $3`,
        ['EMPLOYER', employer.id, 'STATIC']
      );
      if (existingStatic.length === 0) {
        await queryRunner.query(
          `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), null, null, true)`,
          [uuidv4(), uuidv4(), 'STATIC', 'EMPLOYER', employer.id]
        );
      }
      // Check if DYNAMIC already exists
      const existingDynamic = await queryRunner.query(
        `SELECT id FROM qr_codes WHERE "ownerType" = $1 AND "ownerId" = $2 AND type = $3`,
        ['EMPLOYER', employer.id, 'DYNAMIC']
      );
      if (existingDynamic.length === 0) {
        const dynamicToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await queryRunner.query(
          `INSERT INTO qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") VALUES ($1, $2, $3, $4, $5, now(), now(), $6, now(), true)`,
          [uuidv4(), dynamicToken, 'DYNAMIC', 'EMPLOYER', employer.id, expiresAt]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM qr_codes');
  }
}
