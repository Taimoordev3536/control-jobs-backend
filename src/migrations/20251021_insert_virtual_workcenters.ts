import { MigrationInterface, QueryRunner } from 'typeorm'

export class InsertVirtualWorkCenters20251021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert two sentinel work centers with negative IDs
    await queryRunner.query(`
      INSERT INTO work_center (id, name, address, "created_at", "updated_at")
      VALUES
        (-1, 'In itinere - In', 'before check in', now(), now()),
        (-2, 'In itinere - Out', 'after check out', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM work_center WHERE id IN (-1, -2)`)
  }
}
