import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreatePartnerUsersTable1747228668004 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "cjobs_partnersUsuarios",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "partner_id", type: "int" },
                    { name: "user_id", type: "int" },
                    { name: "is_default", type: "boolean", default: false },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                    { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
                ]
            }),
            true
        );

        // Add FK for partner_id (references cjobs_partners.id)
        await queryRunner.createForeignKey("cjobs_partnersUsuarios", new TableForeignKey({
            columnNames: ["partner_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "cjobs_partners",
            onDelete: "CASCADE"
        }));

        // Add FK for user_id (references cjobs_user.id)
        await queryRunner.createForeignKey("cjobs_partnersUsuarios", new TableForeignKey({
            columnNames: ["user_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "cjobs_user",
            onDelete: "CASCADE"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("cjobs_partnersUsuarios");
        const foreignKeys = table.foreignKeys;
        for (const fk of foreignKeys) {
            await queryRunner.dropForeignKey("cjobs_partnersUsuarios", fk);
        }
        await queryRunner.dropTable("cjobs_partnersUsuarios");
    }
} 