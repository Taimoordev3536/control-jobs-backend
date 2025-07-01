import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateUsersTable1747228667998 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // First create the roles table
        await queryRunner.createTable(
            new Table({
                name: 'cjobs_roles',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        isUnique: true,
                    },
                    {
                        name: 'value',
                        type: 'int',
                    },
                ],
            }),
            true,
        );

        // Then create the users table
        await queryRunner.createTable(
            new Table({
                name: 'cjobs_user',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        isUnique: true,
                    },
                    {
                        name: 'password',
                        type: 'varchar',
                    },
                    {
                        name: 'first_name',
                        type: 'varchar',
                    },
                    {
                        name: 'last_name',
                        type: 'varchar',
                    },
                    {
                        name: 'role_id',
                        type: 'int',
                    },
                    {
                        name: 'partner_id',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Add foreign key for role_id
        await queryRunner.createForeignKey(
            'cjobs_user',
            new TableForeignKey({
                columnNames: ['role_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'cjobs_roles',
                onDelete: 'CASCADE',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const userTable = await queryRunner.getTable('cjobs_user');
        const foreignKeys = userTable.foreignKeys;

        // Drop all foreign keys
        for (const foreignKey of foreignKeys) {
            await queryRunner.dropForeignKey('cjobs_user', foreignKey);
        }

        await queryRunner.dropTable('cjobs_user');
        await queryRunner.dropTable('cjobs_roles');
    }
} 