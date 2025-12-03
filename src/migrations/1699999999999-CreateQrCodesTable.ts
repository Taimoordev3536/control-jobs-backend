import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQrCodesTable1699999999999 implements MigrationInterface {
  name = 'CreateQrCodesTable1699999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "qr_codes_type_enum" AS ENUM('STATIC', 'DYNAMIC');
    `);
    await queryRunner.query(`
      CREATE TYPE "qr_codes_ownertype_enum" AS ENUM('CLIENT', 'EMPLOYER');
    `);
    await queryRunner.query(`
      CREATE TABLE "qr_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying(44) NOT NULL,
        "type" "qr_codes_type_enum" NOT NULL,
        "ownerType" "qr_codes_ownertype_enum" NOT NULL,
        "ownerId" bigint NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP,
        "lastRefreshedAt" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_qr_codes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_qr_codes_ownerType_ownerId_type" UNIQUE ("ownerType", "ownerId", "type")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_qr_codes_expiresAt" ON "qr_codes" ("expiresAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_qr_codes_expiresAt"`);
    await queryRunner.query(`DROP TABLE "qr_codes"`);
    await queryRunner.query(`DROP TYPE "qr_codes_type_enum"`);
    await queryRunner.query(`DROP TYPE "qr_codes_ownertype_enum"`);
  }
}
