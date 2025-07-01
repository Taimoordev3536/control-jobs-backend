import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNameToClient1750770000000 implements MigrationInterface {
    name = 'AddNameToClient1750770000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clients ADD name varchar(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE clients DROP COLUMN name`);
    }
}
