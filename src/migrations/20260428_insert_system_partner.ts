import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Method 3 — User self-registration.
 * Insert a "system" partner row used as the counterparty for employers who
 * sign themselves up via /register (no real partner involved).
 *
 * Idempotent: only inserts if no partner with name='ControlJobs' yet exists.
 * The resulting id is logged so it can be set as SYSTEM_PARTNER_ID env var.
 */
export class InsertSystemPartner20260428 implements MigrationInterface {
  name = 'InsertSystemPartner20260428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Ensuring "ControlJobs" system partner exists');

    const existing = await queryRunner.query(
      `SELECT id FROM "cjobs_partners" WHERE name = 'ControlJobs' LIMIT 1`,
    );
    if (existing.length > 0) {
      console.log(`✓ Already present at id=${existing[0].id}. Set SYSTEM_PARTNER_ID=${existing[0].id} in .env`);
      return;
    }

    const result = await queryRunner.query(`
      INSERT INTO "cjobs_partners"
        ("name", "address", "nif", "type_of_partner",
         "commission", "retention", "partner_tier_id")
      VALUES
        ('ControlJobs', 'Internal', 'SYSTEM', 'AFFILIATE', 0.00, 0.00, 1)
      RETURNING "id";
    `);
    const id = result[0]?.id;
    console.log(`✅ "ControlJobs" system partner inserted at id=${id}`);
    console.log(`   ➜ Set SYSTEM_PARTNER_ID=${id} in your .env to enable self-registration.`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "cjobs_partners" WHERE name = 'ControlJobs' AND nif = 'SYSTEM'`,
    );
    console.log('↩️  ControlJobs system partner removed');
  }
}
