import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImpersonationLogTable20260416 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cjobs_impersonation_log (
        id SERIAL PRIMARY KEY,
        impersonator_user_id INTEGER NOT NULL REFERENCES cjobs_user(id) ON DELETE CASCADE,
        impersonator_role VARCHAR(50) NOT NULL,
        target_user_id INTEGER NOT NULL REFERENCES cjobs_user(id) ON DELETE CASCADE,
        target_role VARCHAR(50) NOT NULL,
        target_entity_id INTEGER,
        target_entity_type VARCHAR(50),
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_log_impersonator
        ON cjobs_impersonation_log (impersonator_user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_log_target
        ON cjobs_impersonation_log (target_user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_log_created_at
        ON cjobs_impersonation_log (created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_impersonation_log_created_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_impersonation_log_target;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_impersonation_log_impersonator;`);
    await queryRunner.query(`DROP TABLE IF EXISTS cjobs_impersonation_log;`);
  }
}
