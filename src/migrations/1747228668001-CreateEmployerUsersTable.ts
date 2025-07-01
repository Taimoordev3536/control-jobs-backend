import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateEmployerUsersTable1747228668001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'employers_users',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'employer_id',
                        type: 'int',
                    },
                    {
                        name: 'user_id',
                        type: 'int',
                    },
                    {
                        name: 'is_default',
                        type: 'boolean',
                        default: false,
                    },
                ],
            }),
            true,
        );

        // Add foreign key for employer_id
        await queryRunner.createForeignKey(
            'employers_users',
            new TableForeignKey({
                columnNames: ['employer_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'employers',
                onDelete: 'CASCADE',
            }),
        );

        // Add foreign key for user_id
        await queryRunner.createForeignKey(
            'employers_users',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'cjobs_user',
                onDelete: 'CASCADE',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('employers_users');
        const foreignKeys = table.foreignKeys;

        // Drop all foreign keys
        for (const foreignKey of foreignKeys) {
            await queryRunner.dropForeignKey('employers_users', foreignKey);
        }

        await queryRunner.dropTable('employers_users');
    }
} 